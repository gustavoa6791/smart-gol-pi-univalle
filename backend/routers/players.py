from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("/", response_model=List[schemas.PlayerOut])
def list_players(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.Player).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.PlayerOut, status_code=status.HTTP_201_CREATED)
def create_player(
    player_data: schemas.PlayerCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = models.Player(**player_data.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}", response_model=schemas.PlayerOut)
def get_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.put("/{player_id}", response_model=schemas.PlayerOut)
def update_player(
    player_id: int,
    player_data: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    update_data = player_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    db.delete(player)
    db.commit()
