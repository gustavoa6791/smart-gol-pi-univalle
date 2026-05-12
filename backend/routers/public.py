from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, desc
from typing import Dict, Optional
from collections import defaultdict

from database import get_db
import models

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)):
    """Resumen general para la landing publica."""
    total_players = db.query(func.count(models.Player.id)).scalar() or 0
    total_teams = db.query(func.count(models.Team.id)).scalar() or 0
    total_tournaments = db.query(func.count(models.Tournament.id)).scalar() or 0
    total_matches = db.query(func.count(models.Match.id)).scalar() or 0
    played_matches = db.query(func.count(models.Match.id)).filter(
        models.Match.status == models.MatchStatus.played
    ).scalar() or 0

    total_goals = db.query(func.coalesce(func.sum(models.MatchPlayerStat.goals), 0)).scalar() or 0
    total_yellow_cards = db.query(func.coalesce(func.sum(models.MatchPlayerStat.yellow_cards), 0)).scalar() or 0
    total_red_cards = db.query(func.coalesce(func.sum(models.MatchPlayerStat.red_cards), 0)).scalar() or 0

    return {
        "total_players": int(total_players),
        "total_teams": int(total_teams),
        "total_tournaments": int(total_tournaments),
        "total_matches": int(total_matches),
        "played_matches": int(played_matches),
        "total_goals": int(total_goals),
        "total_yellow_cards": int(total_yellow_cards),
        "total_red_cards": int(total_red_cards),
    }


@router.get("/tournaments")
def get_public_tournaments(db: Session = Depends(get_db)):
    """Lista publica de torneos."""
    tournaments = db.query(models.Tournament).options(
        selectinload(models.Tournament.template),
        selectinload(models.Tournament.teams),
    ).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "type": t.template.type.value if t.template else None,
            "teams_count": len(t.teams),
            "teams_advance_per_group": t.template.teams_advance_per_group if t.template else None,
        }
        for t in tournaments
    ]


@router.get("/recent-matches")
def get_recent_matches(limit: int = 5, db: Session = Depends(get_db)):
    """Ultimos partidos jugados."""
    matches = db.query(models.Match).options(
        selectinload(models.Match.home_team),
        selectinload(models.Match.away_team),
    ).filter(
        models.Match.status == models.MatchStatus.played
    ).order_by(desc(models.Match.id)).limit(limit).all()

    return [
        {
            "id": m.id,
            "tournament_id": m.tournament_id,
            "home_team": m.home_team.name if m.home_team else None,
            "away_team": m.away_team.name if m.away_team else None,
            "home_score": m.home_score,
            "away_score": m.away_score,
        }
        for m in matches
    ]


@router.get("/top-scorers")
def get_top_scorers(limit: int = 5, db: Session = Depends(get_db)):
    """Top goleadores globales (todos los torneos)."""
    stats = db.query(models.MatchPlayerStat).options(
        selectinload(models.MatchPlayerStat.player),
    ).join(models.Match, models.MatchPlayerStat.match_id == models.Match.id).filter(
        models.Match.status == models.MatchStatus.played,
    ).all()

    teams_by_id = {t.id: t for t in db.query(models.Team).all()}

    agg: dict = {}
    for s in stats:
        if s.goals <= 0 or not s.player:
            continue
        row = agg.get(s.player_id)
        if not row:
            full_name = " ".join(filter(None, [
                s.player.first_name, s.player.second_name,
                s.player.first_surname, s.player.second_surname,
            ])).strip()
            team = teams_by_id.get(s.team_id)
            row = {
                "player_id": s.player_id,
                "player_name": full_name,
                "team_name": team.name if team else "",
                "goals": 0,
            }
            agg[s.player_id] = row
        row["goals"] += s.goals

    sorted_rows = sorted(agg.values(), key=lambda r: r["goals"], reverse=True)
    return sorted_rows[:limit]


# ─── PER-TOURNAMENT PUBLIC ENDPOINTS ─────────────────────────────────────────

@router.get("/tournaments/{tournament_id}/matches")
def get_tournament_matches(tournament_id: int, db: Session = Depends(get_db)):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = db.query(models.Match).options(
        selectinload(models.Match.home_team),
        selectinload(models.Match.away_team),
    ).filter(
        models.Match.tournament_id == tournament_id
    ).order_by(models.Match.round, models.Match.id).all()

    return [
        {
            "id": m.id,
            "round": m.round,
            "phase": m.phase.value if m.phase else None,
            "group_name": m.group_name,
            "home_team": m.home_team.name if m.home_team else None,
            "away_team": m.away_team.name if m.away_team else None,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "status": m.status.value,
        }
        for m in matches
    ]


@router.get("/tournaments/{tournament_id}/standings")
def get_tournament_standings(
    tournament_id: int,
    group: Optional[str] = None,
    db: Session = Depends(get_db),
):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.template),
        selectinload(models.Tournament.teams),
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

    if template and template.type == models.TournamentType.mixed:
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


@router.get("/tournaments/{tournament_id}/scorers")
def get_tournament_scorers(tournament_id: int, db: Session = Depends(get_db)):
    tournament = db.query(models.Tournament).options(
        selectinload(models.Tournament.teams),
    ).filter(models.Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    stats = db.query(models.MatchPlayerStat).options(
        selectinload(models.MatchPlayerStat.player),
    ).join(models.Match, models.MatchPlayerStat.match_id == models.Match.id).filter(
        models.Match.tournament_id == tournament_id,
        models.Match.status == models.MatchStatus.played,
    ).all()

    teams_by_id = {t.id: t for t in tournament.teams}

    agg: dict = {}
    for s in stats:
        if s.goals <= 0 or not s.player:
            continue
        row = agg.get(s.player_id)
        if not row:
            team = teams_by_id.get(s.team_id)
            full_name = " ".join(filter(None, [
                s.player.first_name, s.player.second_name,
                s.player.first_surname, s.player.second_surname,
            ])).strip()
            row = {
                "player_id": s.player_id,
                "player_name": full_name,
                "team_name": team.name if team else "",
                "goals": 0,
            }
            agg[s.player_id] = row
        row["goals"] += s.goals

    return sorted(agg.values(), key=lambda r: r["goals"], reverse=True)
