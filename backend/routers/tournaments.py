from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Dict
from collections import defaultdict

from database import get_db
import models, schemas, auth as auth_utils
from services.fixture import generate_fixture

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


@router.get("/", response_model=List[schemas.TournamentOut])
def list_tournaments(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.Tournament).all()


@router.post("/", response_model=schemas.TournamentOut, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament_data: schemas.TournamentCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    # 🔴 VALIDACIÓN IMPORTANTE
    template = db.query(models.TournamentTemplate).filter(
        models.TournamentTemplate.id == tournament_data.template_id
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La plantilla de torneo no existe",
        )

    tournament = models.Tournament(**tournament_data.model_dump())

    try:
        db.add(tournament)
        db.commit()
        db.refresh(tournament)
        return tournament

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear torneo: {str(e)}"
        )


@router.get("/{tournament_id}", response_model=schemas.TournamentOut)
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()

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

    # Eliminar partidos y sus stats
    matches = db.query(models.Match).filter(models.Match.tournament_id == tournament_id).all()
    for m in matches:
        db.query(models.MatchPlayerStat).filter(models.MatchPlayerStat.match_id == m.id).delete()
    db.query(models.Match).filter(models.Match.tournament_id == tournament_id).delete()

    # Limpiar relación con equipos
    tournament.teams.clear()

    db.delete(tournament)
    db.commit()


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

    # Obtener equipos válidos
    teams = db.query(models.Team).filter(
        models.Team.id.in_(body.team_ids)
    ).all()

    if len(teams) != len(body.team_ids):
        raise HTTPException(
            status_code=400,
            detail="Uno o más equipos no existen"
        )

    # Evitar duplicados
    existing_team_ids = {team.id for team in tournament.teams}
    new_teams = [team for team in teams if team.id not in existing_team_ids]

    if not new_teams:
        return {"message": "No hay equipos nuevos para agregar"}

    tournament.teams.extend(new_teams)

    db.commit()

    return {
        "message": f"{len(new_teams)} equipos agregados correctamente"
    }

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

@router.post("/{tournament_id}/generate-fixture")
def generate_tournament_fixture(tournament_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth_utils.get_current_user)):
    
    tournament = db.query(models.Tournament).filter(models.Tournament.id == tournament_id).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    teams = tournament.teams

    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Not enough teams")

    is_home_away = tournament.template.is_home_away

    rounds = generate_fixture(teams, is_home_away)

    matches_created = []

    for round_index, matches in enumerate(rounds, start=1):
        for home, away in matches:
            match = models.Match(
                tournament_id=tournament.id,
                home_team_id=home.id,
                away_team_id=away.id,
                round=round_index
            )
            db.add(match)
            matches_created.append(match)

    db.commit()

    return {
        "message": "Fixture generated",
        "total_matches": len(matches_created),
        "rounds": len(rounds)
    }

@router.get("/{tournament_id}/matches", response_model=List[schemas.MatchOut])
def get_matches(tournament_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth_utils.get_current_user)):
    matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id
    ).order_by(models.Match.round).all()

    return matches


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

    match.home_score = body.home_score
    match.away_score = body.away_score
    match.status = models.MatchStatus.played
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

    # Eliminar stats anteriores
    db.query(models.MatchPlayerStat).filter(
        models.MatchPlayerStat.match_id == match_id
    ).delete()

    # Calcular scores por equipo
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

    match.home_score = home_score
    match.away_score = away_score
    match.status = models.MatchStatus.played
    db.commit()

    # Recargar con relaciones
    match = db.query(models.Match).options(
        selectinload(models.Match.home_team).selectinload(models.Team.players),
        selectinload(models.Match.away_team).selectinload(models.Team.players),
        selectinload(models.Match.player_stats).selectinload(models.MatchPlayerStat.player),
    ).filter(models.Match.id == match_id).first()

    return match


@router.get("/{tournament_id}/standings", response_model=List[schemas.StandingRow])
def get_standings(tournament_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth_utils.get_current_user)):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Inicializar tabla con todos los equipos del torneo
    table: Dict[int, dict] = {}
    for team in tournament.teams:
        table[team.id] = {
            "team_id": team.id,
            "team_name": team.name,
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "goals_for": 0,
            "goals_against": 0,
            "goal_difference": 0,
            "points": 0,
        }

    # Procesar solo partidos jugados
    played_matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.status == models.MatchStatus.played,
    ).all()

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
            home["points"] += 3
            away["lost"] += 1
        elif hs < aws:
            away["won"] += 1
            away["points"] += 3
            home["lost"] += 1
        else:
            home["drawn"] += 1
            away["drawn"] += 1
            home["points"] += 1
            away["points"] += 1

    for row in table.values():
        row["goal_difference"] = row["goals_for"] - row["goals_against"]

    # Ordenar: puntos desc, diferencia de gol desc, goles a favor desc
    standings = sorted(
        table.values(),
        key=lambda r: (r["points"], r["goal_difference"], r["goals_for"]),
        reverse=True,
    )

    return standings