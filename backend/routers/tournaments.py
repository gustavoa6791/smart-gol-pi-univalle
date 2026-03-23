from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas
from services.fixture import generate_fixture

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


@router.get("/", response_model=List[schemas.TournamentOut])
def list_tournaments(
    db: Session = Depends(get_db),
):
    return db.query(models.Tournament).all()


@router.post("/", response_model=schemas.TournamentOut, status_code=status.HTTP_201_CREATED)
def create_tournament(
    tournament_data: schemas.TournamentCreate,
    db: Session = Depends(get_db),
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
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    return tournament

@router.post("/{tournament_id}/teams")
def add_teams_to_tournament(
    tournament_id: int,
    body: schemas.TournamentTeamAssign,
    db: Session = Depends(get_db),
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
):
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    return tournament.teams

@router.post("/{tournament_id}/generate-fixture")
def generate_tournament_fixture(tournament_id: int, db: Session = Depends(get_db)):
    
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
def get_matches(tournament_id: int, db: Session = Depends(get_db)):
    matches = db.query(models.Match).filter(
        models.Match.tournament_id == tournament_id
    ).order_by(models.Match.round).all()

    return matches