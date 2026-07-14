from fastapi import APIRouter, UploadFile, File, HTTPException

from services.face_service import face_service


router = APIRouter(prefix="/api/face", tags=["Face API"])


@router.post("/verify-test")
async def verify_test(
    registered_photo: UploadFile = File(...),
    current_photo: UploadFile = File(...),
):
    try:
        registered_bytes = await registered_photo.read()
        current_bytes = await current_photo.read()

        result = face_service.verify_faces(
            image1_bytes=registered_bytes,
            image2_bytes=current_bytes,
        )

        return {
            "status": "success",
            "message": "Verificación facial realizada",
            "result": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error en Face API: {str(e)}",
        )