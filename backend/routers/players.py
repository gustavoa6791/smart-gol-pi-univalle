import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload
from typing import List

from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/players", tags=["players"])

UPLOAD_DIR = "/app/uploads"
PHOTOS_DIR = os.path.join(UPLOAD_DIR, "photos")
DOCS_DIR = os.path.join(UPLOAD_DIR, "docs")

os.makedirs(PHOTOS_DIR, exist_ok=True)
os.makedirs(DOCS_DIR, exist_ok=True)

ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def _player_query(db: Session):
    return db.query(models.Player).options(
        selectinload(models.Player.documents)
    )


@router.get("/", response_model=List[schemas.PlayerOut])
def list_players(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return _player_query(db).offset(skip).limit(limit).all()


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
    return _player_query(db).filter(models.Player.id == player.id).first()


@router.get("/{player_id}", response_model=schemas.PlayerOut)
def get_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = _player_query(db).filter(models.Player.id == player_id).first()
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
    return _player_query(db).filter(models.Player.id == player_id).first()


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    # Limpiar referencias antes de eliminar
    db.query(models.Team).filter(models.Team.leader_id == player_id).update({"leader_id": None})
    db.query(models.MatchPlayerStat).filter(models.MatchPlayerStat.player_id == player_id).delete()
    db.delete(player)
    db.commit()


@router.post("/{player_id}/photo", response_model=schemas.PlayerOut)
async def upload_photo(
    player_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use JPG, PNG o WebP.")

    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(PHOTOS_DIR, filename)

    # Eliminar foto anterior si existe
    if player.photo_url:
        old_path = os.path.join(UPLOAD_DIR, player.photo_url.lstrip("/uploads/"))
        if os.path.exists(old_path):
            os.remove(old_path)

    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    player.photo_url = f"/uploads/photos/{filename}"
    db.commit()
    return _player_query(db).filter(models.Player.id == player_id).first()


@router.delete("/{player_id}/photo", response_model=schemas.PlayerOut)
def delete_photo(
    player_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if player.photo_url:
        path = os.path.join(UPLOAD_DIR, player.photo_url.replace("/uploads/", ""))
        if os.path.exists(path):
            os.remove(path)
        player.photo_url = None
        db.commit()

    return _player_query(db).filter(models.Player.id == player_id).first()


@router.post("/{player_id}/documents", response_model=schemas.PlayerOut)
async def upload_document(
    player_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PDF, JPG o PNG.")

    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(DOCS_DIR, filename)

    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    doc = models.PlayerDocument(
        player_id=player_id,
        filename=f"/uploads/docs/{filename}",
        original_name=file.filename,
    )
    db.add(doc)
    db.commit()
    return _player_query(db).filter(models.Player.id == player_id).first()


@router.delete("/{player_id}/documents/{doc_id}", response_model=schemas.PlayerOut)
def delete_document(
    player_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    doc = db.query(models.PlayerDocument).filter(
        models.PlayerDocument.id == doc_id,
        models.PlayerDocument.player_id == player_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = os.path.join(UPLOAD_DIR, doc.filename.replace("/uploads/", ""))
    if os.path.exists(path):
        os.remove(path)

    db.delete(doc)
    db.commit()
    return _player_query(db).filter(models.Player.id == player_id).first()
