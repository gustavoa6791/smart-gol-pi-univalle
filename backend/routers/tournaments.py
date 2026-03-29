from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Dict, Optional
from collections import defaultdict

from database import get_db
import models, schemas, auth as auth_utils
from services.fixture import generate_fixture, generate_knockout_bracket, generate_mixed_fixture

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


# ─── TOURNAMENT CRUD ─────────────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.TournamentOut])
def list_tournaments(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).all()


@router.post("/", response_model=schemas.TournamentOut, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament_data: schemas.TournamentCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    template = db.query(models.TournamentTemplate).filter(
        models.TournamentTemplate.id == tournament_data.template_id
    ).first()
    if not template:
        raise HTTPException(status_code=400, detail="La plantilla de torneo no existe")

    tournament = models.Tournament(**tournament_data.model_dump())
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).filter(models.Tournament.id == tournament.id).first()


@router.get("/{tournament_id}", response_model=schemas.TournamentOut)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament


@router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = db.query(models.Match).filter(models.Match.tournament_id == tournament_id).all()
    for m in matches:
        db.query(models.MatchPlayerStat).filter(models.MatchPlayerStat.match_id == m.id).delete()
    db.query(models.Match).filter(models.Match.tournament_id == tournament_id).delete()
    tournament.teams.clear()
    db.delete(tournament)
    db.commit()


# ─── TEAMS ASSIGNMENT ────────────────────────────────────────────────────────

@router.post("/{tournament_id}/teams")
def add_teams_to_tournament(
    tournament_id: int,
    body: schemas.TournamentTeamAssign,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    teams = db.query(models.Team).filter(models.Team.id.in_(body.team_ids)).all()
    if len(teams) != len(body.team_ids):
        raise HTTPException(status_code=400, detail="Uno o mas equipos no existen")

    existing_ids = {t.id for t in tournament.teams}
    new_teams = [t for t in teams if t.id not in existing_ids]

    if not new_teams:
        return {"message": "No hay equipos nuevos para agregar"}

    tournament.teams.extend(new_teams)
    db.commit()
    return {"message": f"{len(new_teams)} equipos agregados correctamente"}


@router.get("/{tournament_id}/teams", response_model=List[schemas.TeamOut])
def get_tournament_teams(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament.teams


# ─── FIXTURE GENERATION ──────────────────────────────────────────────────────

def _min_teams_for_type(template):
    t = template.type
    if t == models.TournamentType.round_robin:
        return 3
    elif t == models.TournamentType.knockout:
        return 2
    elif t == models.TournamentType.mixed:
        return max(4, (template.num_groups or 2) * 2)
    return 2


@router.post("/{tournament_id}/generate-fixture")
def generate_tournament_fixture(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    existing = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id
    ).count()
    if existing > 0:
        raise HTTPException(status_code=400, detail="El fixture ya fue generado. Elimina los partidos existentes primero.")

    teams = tournament.teams
    template = tournament.template
    min_teams = _min_teams_for_type(template)

    if len(teams) < min_teams:
        raise HTTPException(
            status_code=400,
            detail=f"Se necesitan al menos {min_teams} equipos para este formato. Hay {len(teams)}."
        )

    if template.type == models.TournamentType.mixed:
        num_groups = template.num_groups or 2
        if len(teams) % num_groups != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Para {num_groups} grupos, el numero de equipos ({len(teams)}) debe ser divisible por {num_groups}."
            )

    tournament_type = template.type
    is_home_away = bool(template.is_home_away)
    third_place = bool(template.third_place_match)

    matches_created = []

    if tournament_type == models.TournamentType.round_robin:
        rounds = generate_fixture(list(teams), is_home_away)
        # Si es ida y vuelta, la primera mitad es ida (leg=1), la segunda vuelta (leg=2)
        total_rounds = len(rounds)
        first_leg_count = total_rounds // 2 if is_home_away else total_rounds
        for round_idx, round_matches in enumerate(rounds, start=1):
            leg = None
            if is_home_away:
                leg = 1 if round_idx <= first_leg_count else 2
            for home, away in round_matches:
                match = models.Match(
                    tournament_id=tournament_id,
                    home_team_id=home.id,
                    away_team_id=away.id,
                    round=round_idx,
                    leg=leg,
                )
                db.add(match)
                matches_created.append(match)

    elif tournament_type == models.TournamentType.knockout:
        bracket = generate_knockout_bracket(
            list(teams),
            is_home_away=is_home_away,
            third_place=third_place,
            final_legs=template.final_legs or 1,
            third_place_legs=template.third_place_legs or 1,
        )
        db_matches = []
        for match_data in bracket:
            match = models.Match(
                tournament_id=tournament_id,
                home_team_id=match_data["home_team_id"],
                away_team_id=match_data["away_team_id"],
                round=match_data["round"],
                leg=match_data.get("leg"),
                phase=match_data["phase"],
                bracket_position=match_data["bracket_position"],
            )
            db.add(match)
            db_matches.append(match)

        db.flush()

        for i, match_data in enumerate(bracket):
            next_idx = match_data.get("next_match_index")
            if next_idx is not None and next_idx < len(db_matches):
                db_matches[i].next_match_id = db_matches[next_idx].id

        matches_created = db_matches

    elif tournament_type == models.TournamentType.mixed:
        num_groups = template.num_groups or 2
        teams_advance = template.teams_advance_per_group or 1
        result = generate_mixed_fixture(
            list(teams), num_groups, teams_advance,
            is_home_away=is_home_away, third_place=third_place,
            final_legs=template.final_legs or 1,
            third_place_legs=template.third_place_legs or 1,
        )

        for gm in result["group_matches"]:
            match = models.Match(
                tournament_id=tournament_id,
                home_team_id=gm["home_team_id"],
                away_team_id=gm["away_team_id"],
                round=gm["round"],
                leg=gm.get("leg"),
                phase=gm["phase"],
                group_name=gm["group_name"],
            )
            db.add(match)
            matches_created.append(match)

        ko_db_matches = []
        for km in result["knockout_matches"]:
            match = models.Match(
                tournament_id=tournament_id,
                home_team_id=km["home_team_id"],
                away_team_id=km["away_team_id"],
                round=km["round"],
                phase=km["phase"],
                bracket_position=km["bracket_position"],
            )
            db.add(match)
            ko_db_matches.append(match)

        db.flush()

        for i, km in enumerate(result["knockout_matches"]):
            next_idx = km.get("next_match_index")
            if next_idx is not None and next_idx < len(ko_db_matches):
                ko_db_matches[i].next_match_id = ko_db_matches[next_idx].id

        matches_created.extend(ko_db_matches)

    db.commit()

    return {
        "message": "Fixture generado",
        "total_matches": len(matches_created),
    }


# ─── MATCHES ─────────────────────────────────────────────────────────────────

@router.get("/{tournament_id}/matches", response_model=List[schemas.MatchOut])
def get_matches(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id
    ).order_by(models.Match.round, models.Match.id).all()


def _try_advance_knockout(match, db):
    """
    Intenta avanzar al ganador de una llave knockout.
    - Single match: avanza si no hay empate, o si hay penales.
    - Ida/vuelta: avanza cuando ambos legs jugados. Si global empate, necesita penales en leg 2.
    """
    if not match.next_match_id or not match.home_team_id or not match.away_team_id:
        return

    other_leg = None
    if match.leg:
        other_leg = db.query(models.Match).filter(
            models.Match.tournament_id == match.tournament_id,
            models.Match.phase == match.phase,
            models.Match.bracket_position == match.bracket_position,
            models.Match.leg != match.leg,
        ).first()

    winner_id = None
    loser_id = None

    if match.leg and other_leg:
        # Ida y vuelta
        if other_leg.status != models.MatchStatus.played:
            return

        if match.leg == 1:
            leg1, leg2 = match, other_leg
        else:
            leg1, leg2 = other_leg, match

        team_a = leg1.home_team_id
        team_b = leg1.away_team_id
        goals_a = (leg1.home_score or 0) + (leg2.away_score or 0)
        goals_b = (leg1.away_score or 0) + (leg2.home_score or 0)

        if goals_a > goals_b:
            winner_id, loser_id = team_a, team_b
        elif goals_b > goals_a:
            winner_id, loser_id = team_b, team_a
        else:
            # Empate global: necesita penales en leg 2
            if leg2.home_penalty is not None and leg2.away_penalty is not None:
                # leg2 home = team_b, leg2 away = team_a
                pen_a = leg2.away_penalty
                pen_b = leg2.home_penalty
                if pen_a > pen_b:
                    winner_id, loser_id = team_a, team_b
                elif pen_b > pen_a:
                    winner_id, loser_id = team_b, team_a
                else:
                    return  # empate en penales tambien? no deberia pasar
            else:
                return  # esperando penales
    else:
        # Single match
        hs = match.home_score or 0
        aws = match.away_score or 0
        if hs > aws:
            winner_id, loser_id = match.home_team_id, match.away_team_id
        elif aws > hs:
            winner_id, loser_id = match.away_team_id, match.home_team_id
        else:
            # Empate: necesita penales
            if match.home_penalty is not None and match.away_penalty is not None:
                if match.home_penalty > match.away_penalty:
                    winner_id, loser_id = match.home_team_id, match.away_team_id
                elif match.away_penalty > match.home_penalty:
                    winner_id, loser_id = match.away_team_id, match.home_team_id
                else:
                    return
            else:
                return  # esperando penales

    if not winner_id:
        return

    # Avanzar ganador
    next_match = db.query(models.Match).filter(models.Match.id == match.next_match_id).first()
    if next_match:
        next_leg2 = None
        if next_match.leg:
            next_leg2 = db.query(models.Match).filter(
                models.Match.tournament_id == next_match.tournament_id,
                models.Match.phase == next_match.phase,
                models.Match.bracket_position == next_match.bracket_position,
                models.Match.leg != next_match.leg,
            ).first()

        if next_match.home_team_id is None:
            next_match.home_team_id = winner_id
            if next_leg2:
                next_leg2.away_team_id = winner_id
        elif next_match.away_team_id is None:
            next_match.away_team_id = winner_id
            if next_leg2:
                next_leg2.home_team_id = winner_id

    # Tercer puesto
    if match.phase == models.MatchPhase.semifinal:
        third_place_match = db.query(models.Match).filter(
            models.Match.tournament_id == match.tournament_id,
            models.Match.phase == models.MatchPhase.third_place,
        ).first()
        if third_place_match:
            if third_place_match.home_team_id is None:
                third_place_match.home_team_id = loser_id
            elif third_place_match.away_team_id is None:
                third_place_match.away_team_id = loser_id


@router.patch("/matches/{match_id}/score", response_model=schemas.MatchOut)
def update_match_score(
    match_id: int,
    body: schemas.MatchUpdateScore,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Validar penales si se proporcionan
    if body.home_penalty is not None or body.away_penalty is not None:
        if body.home_score != body.away_score:
            raise HTTPException(status_code=400, detail="Los penales solo aplican cuando hay empate en el tiempo regular")
        if body.home_penalty is not None and body.away_penalty is not None:
            if body.home_penalty == body.away_penalty:
                raise HTTPException(status_code=400, detail="Los penales deben tener un ganador")

    match.home_score = body.home_score
    match.away_score = body.away_score
    match.home_penalty = body.home_penalty
    match.away_penalty = body.away_penalty
    match.status = models.MatchStatus.played

    _try_advance_knockout(match, db)

    db.commit()
    db.refresh(match)
    return match


@router.get("/matches/{match_id}/detail", response_model=schemas.MatchDetailOut)
def get_match_detail(
    match_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    match = db.query(models.Match).options(
        selectinload(models.Match.home_team).selectinload(models.Team.players),
        selectinload(models.Match.away_team).selectinload(models.Team.players),
        selectinload(models.Match.player_stats).selectinload(models.MatchPlayerStat.player),
    ).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.post("/matches/{match_id}/stats", response_model=schemas.MatchDetailOut)
def save_match_stats(
    match_id: int,
    body: schemas.SaveMatchStats,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    db.query(models.MatchPlayerStat).filter(
        models.MatchPlayerStat.match_id == match_id
    ).delete()

    home_score = 0
    away_score = 0

    for stat in body.stats:
        db_stat = models.MatchPlayerStat(
            match_id=match_id,
            player_id=stat.player_id,
            team_id=stat.team_id,
            goals=stat.goals,
            yellow_cards=stat.yellow_cards,
            red_cards=stat.red_cards,
        )
        db.add(db_stat)
        if stat.team_id == match.home_team_id:
            home_score += stat.goals
        else:
            away_score += stat.goals

    # Validar penales si se proporcionan
    if body.home_penalty is not None or body.away_penalty is not None:
        if home_score != away_score:
            db.rollback()
            raise HTTPException(status_code=400, detail="Los penales solo aplican cuando hay empate")
        if body.home_penalty is not None and body.away_penalty is not None:
            if body.home_penalty == body.away_penalty:
                db.rollback()
                raise HTTPException(status_code=400, detail="Los penales deben tener un ganador")

    match.home_score = home_score
    match.away_score = away_score
    match.home_penalty = body.home_penalty
    match.away_penalty = body.away_penalty
    match.status = models.MatchStatus.played

    _try_advance_knockout(match, db)

    db.commit()

    return db.query(models.Match).options(
        selectinload(models.Match.home_team).selectinload(models.Team.players),
        selectinload(models.Match.away_team).selectinload(models.Team.players),
        selectinload(models.Match.player_stats).selectinload(models.MatchPlayerStat.player),
    ).filter(models.Match.id == match_id).first()


# ─── ADVANCE TO KNOCKOUT (mixed) ────────────────────────────────────────────

@router.post("/{tournament_id}/advance-to-knockout")
def advance_to_knockout(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.template.type != models.TournamentType.mixed:
        raise HTTPException(status_code=400, detail="Solo aplica para torneos mixtos")

    group_matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.phase == models.MatchPhase.group,
    ).all()

    pending = [m for m in group_matches if m.status != models.MatchStatus.played]
    if pending:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan {len(pending)} partidos de grupo por jugar"
        )

    template = tournament.template
    pts_win = template.points_win
    pts_draw = template.points_draw
    pts_loss = template.points_loss
    teams_advance = template.teams_advance_per_group or 1

    groups: Dict[str, list] = defaultdict(list)
    for m in group_matches:
        if m.group_name:
            groups[m.group_name].append(m)

    # Calcular clasificados por grupo: group_ranked[group_name] = [1ro, 2do, ...]
    group_ranked: Dict[str, list] = {}

    for group_name in sorted(groups.keys()):
        team_ids_in_group = set()
        for m in groups[group_name]:
            if m.home_team_id:
                team_ids_in_group.add(m.home_team_id)
            if m.away_team_id:
                team_ids_in_group.add(m.away_team_id)

        table = {}
        for tid in team_ids_in_group:
            table[tid] = {"team_id": tid, "points": 0, "gd": 0, "gf": 0}

        for m in groups[group_name]:
            hs = m.home_score or 0
            aws = m.away_score or 0
            h = table.get(m.home_team_id)
            a = table.get(m.away_team_id)
            if not h or not a:
                continue
            h["gf"] += hs
            h["gd"] += (hs - aws)
            a["gf"] += aws
            a["gd"] += (aws - hs)
            if hs > aws:
                h["points"] += pts_win
                a["points"] += pts_loss
            elif hs < aws:
                a["points"] += pts_win
                h["points"] += pts_loss
            else:
                h["points"] += pts_draw
                a["points"] += pts_draw

        ranked = sorted(table.values(), key=lambda r: (r["points"], r["gd"], r["gf"]), reverse=True)
        group_ranked[group_name] = [r["team_id"] for r in ranked[:teams_advance]]

    # Seeding cruzado: 1ro de grupo A vs ultimo clasificado de grupo B, etc.
    # Con 2 grupos y 2 clasificados: 1A vs 2B, 1B vs 2A
    # Con 4 grupos y 1 clasificado: 1A vs 1D, 1B vs 1C (cruzar extremos)
    # Logica general: separar por posicion, cruzar entre grupos
    sorted_groups = sorted(group_ranked.keys())
    num_groups_actual = len(sorted_groups)

    qualifiers = []
    if teams_advance == 1:
        # Solo primeros: cruzar extremos (A vs ultimo, B vs penultimo, etc.)
        firsts = [group_ranked[g][0] for g in sorted_groups]
        for i in range(len(firsts) // 2):
            qualifiers.append(firsts[i])
            qualifiers.append(firsts[-(i + 1)])
    else:
        # Multiples clasificados: emparejar 1ro de un grupo vs 2do de otro
        # Patron: para cada llave, tomar posicion N de grupo X vs posicion M de grupo Y
        # donde X != Y y se cruzan posiciones
        positions = [[] for _ in range(teams_advance)]
        for g in sorted_groups:
            for pos in range(teams_advance):
                if pos < len(group_ranked[g]):
                    positions[pos].append(group_ranked[g][pos])

        # Emparejar: 1ros vs ultimos clasificados de otros grupos
        # Con 2 grupos, 2 clasificados: [1A, 1B] y [2A, 2B] -> 1A vs 2B, 1B vs 2A
        firsts = positions[0]  # 1ros de cada grupo
        lasts = positions[-1]  # ultimos clasificados de cada grupo
        lasts_reversed = list(reversed(lasts))

        for i in range(len(firsts)):
            qualifiers.append(firsts[i])
            qualifiers.append(lasts_reversed[i])

        # Si hay posiciones intermedias (3+ clasificados), agregar restantes
        for pos in range(1, teams_advance - 1):
            mid = positions[pos]
            mid_reversed = list(reversed(mid))
            for i in range(len(mid) // 2):
                qualifiers.append(mid[i])
                qualifiers.append(mid_reversed[i])

    knockout_matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.phase != models.MatchPhase.group,
        models.Match.phase.isnot(None),
    ).order_by(models.Match.round, models.Match.bracket_position).all()

    if not knockout_matches:
        raise HTTPException(status_code=400, detail="No se encontro bracket de eliminatoria")

    feeder_match_ids = {m.next_match_id for m in knockout_matches if m.next_match_id}
    first_round = [m for m in knockout_matches if m.id not in feeder_match_ids and m.phase != models.MatchPhase.third_place]
    first_round.sort(key=lambda m: (m.round, m.bracket_position or 0))

    q_idx = 0
    for match in first_round:
        if q_idx < len(qualifiers):
            match.home_team_id = qualifiers[q_idx]
            q_idx += 1
        if q_idx < len(qualifiers):
            match.away_team_id = qualifiers[q_idx]
            q_idx += 1

    db.commit()

    return {
        "message": f"{len(qualifiers)} equipos avanzaron a la fase eliminatoria",
        "qualifiers": qualifiers,
    }


# ─── STANDINGS ───────────────────────────────────────────────────────────────

@router.get("/{tournament_id}/standings", response_model=List[schemas.StandingRow])
def get_standings(
    tournament_id: int,
    group: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.template)
    ).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    template = tournament.template
    pts_win = template.points_win if template else 3
    pts_draw = template.points_draw if template else 1
    pts_loss = template.points_loss if template else 0

    table: Dict[int, dict] = {}
    for team in tournament.teams:
        table[team.id] = {
            "team_id": team.id,
            "team_name": team.name,
            "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "goals_for": 0, "goals_against": 0,
            "goal_difference": 0, "points": 0,
        }

    query = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.status == models.MatchStatus.played,
    )

    if template.type == models.TournamentType.mixed:
        query = query.filter(models.Match.phase == models.MatchPhase.group)

    if group:
        query = query.filter(models.Match.group_name == group)

    played_matches = query.all()

    if group:
        group_team_ids = set()
        for m in played_matches:
            if m.home_team_id:
                group_team_ids.add(m.home_team_id)
            if m.away_team_id:
                group_team_ids.add(m.away_team_id)
        table = {k: v for k, v in table.items() if k in group_team_ids}

    for m in played_matches:
        home = table.get(m.home_team_id)
        away = table.get(m.away_team_id)
        if not home or not away:
            continue

        hs = m.home_score or 0
        aws = m.away_score or 0

        home["played"] += 1
        away["played"] += 1
        home["goals_for"] += hs
        home["goals_against"] += aws
        away["goals_for"] += aws
        away["goals_against"] += hs

        if hs > aws:
            home["won"] += 1
            home["points"] += pts_win
            away["lost"] += 1
            away["points"] += pts_loss
        elif hs < aws:
            away["won"] += 1
            away["points"] += pts_win
            home["lost"] += 1
            home["points"] += pts_loss
        else:
            home["drawn"] += 1
            away["drawn"] += 1
            home["points"] += pts_draw
            away["points"] += pts_draw

    for row in table.values():
        row["goal_difference"] = row["goals_for"] - row["goals_against"]

    return sorted(
        table.values(),
        key=lambda r: (r["points"], r["goal_difference"], r["goals_for"]),
        reverse=True,
    )


# ─── BRACKET ─────────────────────────────────────────────────────────────────

@router.get("/{tournament_id}/bracket")
def get_bracket(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.phase.isnot(None),
        models.Match.phase != models.MatchPhase.group,
    ).order_by(models.Match.round, models.Match.bracket_position).all()

    result = []
    for m in matches:
        result.append({
            "id": m.id,
            "round": m.round,
            "leg": m.leg,
            "phase": m.phase.value if m.phase else None,
            "bracket_position": m.bracket_position,
            "next_match_id": m.next_match_id,
            "home_team": {"id": m.home_team.id, "name": m.home_team.name} if m.home_team else None,
            "away_team": {"id": m.away_team.id, "name": m.away_team.name} if m.away_team else None,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "home_penalty": m.home_penalty,
            "away_penalty": m.away_penalty,
            "status": m.status.value,
        })

    return result
