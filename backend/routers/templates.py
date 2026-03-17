from fastapi import APIRouter, Depends, status
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
    template_data: schemas.TournamentTemplateCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    template = models.TournamentTemplate(
        name=template_data.name,
        is_home_away=1 if template_data.is_home_away else 0
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return template