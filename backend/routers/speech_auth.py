import os
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from database import get_db
import models
import auth as auth_utils
from services.voice_service import voice_service


router = APIRouter(prefix="/api/voice-auth", tags=["Voice Authentication"])


@router.post("/enroll")
async def enroll_voice(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    temp_filename = f"temp_enroll_{current_user.id}.wav"

    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        embedding = voice_service.extract_embedding(temp_filename)

        current_user.voice_embedding = voice_service.serialize_embedding(embedding)
        current_user.voice_enrolled_at = datetime.utcnow()

        db.commit()
        db.refresh(current_user)

        return {
            "status": "success",
            "message": "Perfil de voz registrado correctamente",
            "user_id": current_user.id,
            "email": current_user.email,
            "voice_enrolled_at": current_user.voice_enrolled_at,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error registrando voz: {str(e)}",
        )

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


@router.post("/login")
async def login_by_voice(
    email: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado",
        )

    if not user.voice_embedding:
        raise HTTPException(
            status_code=404,
            detail="El usuario no tiene voz registrada",
        )

    temp_filename = f"temp_login_{user.id}.wav"

    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = voice_service.verify_voice(
            stored_embedding_json=user.voice_embedding,
            audio_path=temp_filename,
            threshold=0.65,
        )

        if not result["accepted"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "message": "Acceso denegado. La voz no coincide.",
                    "similarity": result["similarity"],
                    "threshold": result["threshold"],
                },
            )

        access_token = auth_utils.create_access_token(
            data={"sub": str(user.id)}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role.value if hasattr(user.role, "value") else user.role,
            },
            "voice_result": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error verificando voz: {str(e)}",
        )

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


@router.get("/profile")
def get_my_voice_profile(
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "has_voice_profile": current_user.voice_embedding is not None,
        "voice_enrolled_at": current_user.voice_enrolled_at,
    }


@router.delete("/profile")
def delete_my_voice_profile(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    current_user.voice_embedding = None
    current_user.voice_enrolled_at = None

    db.commit()

    return {
        "status": "success",
        "message": "Perfil de voz eliminado correctamente",
    }