from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/", response_model=List[schemas.TournamentTemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return db.query(models.TournamentTemplate).all()


@router.post("/", response_model=schemas.TournamentTemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    data: schemas.TournamentTemplateCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="El nombre es requerido")

    # Validaciones por tipo
    if data.type == schemas.TournamentType.mixed:
        if not data.num_groups or data.num_groups < 2:
            raise HTTPException(status_code=400, detail="Para formato mixto se requieren al menos 2 grupos")
        if not data.teams_advance_per_group or data.teams_advance_per_group < 1:
            raise HTTPException(status_code=400, detail="Debe indicar cuantos equipos avanzan por grupo (minimo 1)")
        # Validar que los clasificados formen potencia de 2
        total_advance = data.num_groups * data.teams_advance_per_group
        if total_advance < 2 or (total_advance & (total_advance - 1)) != 0:
            raise HTTPException(
                status_code=400,
                detail=f"El total de clasificados ({total_advance}) debe ser potencia de 2 (2, 4, 8, 16...)"
            )

    # Validar puntos
    if data.points_win < 0 or data.points_draw < 0 or data.points_loss < 0:
        raise HTTPException(status_code=400, detail="Los puntos no pueden ser negativos")

    template = models.TournamentTemplate(
        name=data.name.strip(),
        type=data.type,
        is_home_away=1 if data.is_home_away else 0,
        points_win=data.points_win,
        points_draw=data.points_draw,
        points_loss=data.points_loss,
        num_groups=data.num_groups if data.type == schemas.TournamentType.mixed else None,
        teams_advance_per_group=data.teams_advance_per_group if data.type == schemas.TournamentType.mixed else None,
        third_place_match=1 if data.third_place_match else 0,
        final_legs=data.final_legs if data.final_legs in (1, 2) else 1,
        third_place_legs=data.third_place_legs if data.third_place_legs in (1, 2) else 1,
    )

    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    template = db.query(models.TournamentTemplate).filter(
        models.TournamentTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")

    # Verificar que no haya torneos usando esta plantilla
    count = db.query(models.Tournament).filter(
        models.Tournament.template_id == template_id
    ).count()
    if count > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay torneos usando esta plantilla")

    db.delete(template)
    db.commit()
