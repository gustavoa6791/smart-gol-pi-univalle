from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List

from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _teams_query(db: Session):
    # Cargar tanto los jugadores como el líder para evitar consultas N+1
    return db.query(models.Team).options(
        selectinload(models.Team.players),
        selectinload(models.Team.leader)
    )


@router.get("/", response_model=List[schemas.TeamOut])
def list_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # Devolver TODOS los equipos sin filtrar por usuario
    teams = _teams_query(db).offset(skip).limit(limit).all()
    return teams


@router.post("/", response_model=schemas.TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    team_data: schemas.TeamCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # Validar que el nombre del equipo sea único por categoría
    existing_team = db.query(models.Team).filter(
        models.Team.name == team_data.name,
        models.Team.category == team_data.category
    ).first()
    
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un equipo con el nombre '{team_data.name}' en la categoría {team_data.category.value}",
        )
    
    # Crear el equipo
    team = models.Team(
        name=team_data.name,
        category=team_data.category,
        coach_name=team_data.coach_name,
    )
    
    # Asignar jugadores si se proporcionaron
    if team_data.player_ids:
        players = db.query(models.Player).filter(models.Player.id.in_(team_data.player_ids)).all()
        team.players = players

    # Líder: debe estar en la lista de jugadores del equipo
    if team_data.leader_id is not None:
        player_ids = [p.id for p in team.players] if team.players else []
        if team_data.leader_id not in player_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El líder debe ser un jugador del equipo.",
            )
        team.leader_id = team_data.leader_id

    try:
        db.add(team)
        db.commit()
        db.refresh(team)
        team = _teams_query(db).filter(models.Team.id == team.id).first()
        return team
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el equipo: {str(e)}",
        )


@router.get("/{team_id}", response_model=schemas.TeamOut)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    team = _teams_query(db).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.patch("/{team_id}/leader", response_model=schemas.TeamOut)
def set_team_leader(
    team_id: int,
    body: schemas.SetLeaderBody,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    """Designar o quitar el líder del equipo. Solo un líder por equipo; debe estar en el equipo."""
    team = _teams_query(db).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if body.player_id is None:
        team.leader_id = None
    else:
        player_ids = [p.id for p in team.players] if team.players else []
        if body.player_id not in player_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El líder debe estar asociado al equipo.",
            )
        team.leader_id = body.player_id
    db.commit()
    db.refresh(team)
    # Recargar el equipo con los jugadores y el líder para devolverlos en la respuesta
    team = _teams_query(db).filter(models.Team.id == team_id).first()
    return team


@router.put("/{team_id}", response_model=schemas.TeamOut)
def update_team(
    team_id: int,
    team_data: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Validar nombre único por categoría si se está actualizando el nombre o categoría
    if team_data.name or team_data.category:
        new_name = team_data.name if team_data.name else team.name
        new_category = team_data.category if team_data.category else team.category
        
        existing_team = db.query(models.Team).filter(
            models.Team.name == new_name,
            models.Team.category == new_category,
            models.Team.id != team_id
        ).first()
        
        if existing_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un equipo con el nombre '{new_name}' en la categoría {new_category.value}",
            )
    
    # Actualizar campos básicos (excluir player_ids y leader_id)
    update_data = team_data.model_dump(exclude_unset=True, exclude={'player_ids', 'leader_id'})
    for field, value in update_data.items():
        setattr(team, field, value)

    # Actualizar jugadores si se proporcionaron
    if team_data.player_ids is not None:
        players = db.query(models.Player).filter(models.Player.id.in_(team_data.player_ids)).all()
        team.players = players
        if team.leader_id and team.leader_id not in [p.id for p in team.players]:
            team.leader_id = None

    # Actualizar líder si se proporcionó (debe ser miembro del equipo)
    if team_data.leader_id is not None:
        player_ids = [p.id for p in team.players] if team.players else []
        if team_data.leader_id and team_data.leader_id not in player_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El líder debe ser un jugador del equipo.",
            )
        team.leader_id = team_data.leader_id

    db.commit()
    db.refresh(team)
    # Recargar el equipo con los jugadores y el líder para devolverlos en la respuesta
    team = _teams_query(db).filter(models.Team.id == team_id).first()
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    # Eliminar stats y partidos donde participa el equipo antes de eliminar
    matches = db.query(models.Match).filter(
        (models.Match.home_team_id == team_id) | (models.Match.away_team_id == team_id)
    ).all()
    for match in matches:
        db.query(models.MatchPlayerStat).filter(models.MatchPlayerStat.match_id == match.id).delete()
        db.delete(match)
    db.delete(team)
    db.commit()
