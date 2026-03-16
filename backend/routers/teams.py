from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/", response_model=List[schemas.TeamOut])
def list_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.Team).offset(skip).limit(limit).all()


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
    
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/{team_id}", response_model=schemas.TeamOut)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
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
    
    # Actualizar campos básicos
    update_data = team_data.model_dump(exclude_unset=True, exclude={'player_ids'})
    for field, value in update_data.items():
        setattr(team, field, value)
    
    # Actualizar jugadores si se proporcionaron
    if team_data.player_ids is not None:
        players = db.query(models.Player).filter(models.Player.id.in_(team_data.player_ids)).all()
        team.players = players
    
    db.commit()
    db.refresh(team)
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
    db.delete(team)
    db.commit()
