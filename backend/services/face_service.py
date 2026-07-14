from fastapi import HTTPException

from config.settings import FACE_PROVIDER
from services.local_face_service import local_face_service


class FaceService:
    def verify_faces(
        self,
        image1_bytes: bytes,
        image2_bytes: bytes,
    ) -> dict:
        if FACE_PROVIDER == "local":
            return local_face_service.verify_faces(
                image1_bytes=image1_bytes,
                image2_bytes=image2_bytes,
            )

        if FACE_PROVIDER == "azure":
            return self._verify_with_azure(
                image1_bytes=image1_bytes,
                image2_bytes=image2_bytes,
            )

        raise HTTPException(
            status_code=500,
            detail=f"Proveedor facial no válido: {FACE_PROVIDER}",
        )

    @staticmethod
    def _verify_with_azure(
        image1_bytes: bytes,
        image2_bytes: bytes,
    ) -> dict:
        from azure.core.credentials import AzureKeyCredential
        from azure.ai.vision.face import FaceClient
        from azure.ai.vision.face.models import (
            FaceDetectionModel,
            FaceRecognitionModel,
        )

        from config.settings import AZURE_FACE_ENDPOINT, AZURE_FACE_KEY

        if not AZURE_FACE_ENDPOINT or not AZURE_FACE_KEY:
            raise HTTPException(
                status_code=503,
                detail="Azure Face API no está configurado",
            )

        client = FaceClient(
            endpoint=AZURE_FACE_ENDPOINT,
            credential=AzureKeyCredential(AZURE_FACE_KEY),
        )

        def detect_single_face_id(image_bytes: bytes) -> str:
            faces = client.detect(
                image_content=image_bytes,
                detection_model=FaceDetectionModel.DETECTION03,
                recognition_model=FaceRecognitionModel.RECOGNITION04,
                return_face_id=True,
            )

            if not faces:
                raise HTTPException(
                    status_code=400,
                    detail="No se detectó ningún rostro en la imagen",
                )

            if len(faces) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="La imagen debe contener un solo rostro",
                )

            return faces[0].face_id

        face_id_1 = detect_single_face_id(image1_bytes)
        face_id_2 = detect_single_face_id(image2_bytes)

        result = client.verify_face_to_face(
            face_id1=face_id_1,
            face_id2=face_id_2,
        )

        return {
            "provider": "azure",
            "is_identical": bool(result.is_identical),
            "confidence": float(result.confidence),
        }


face_service = FaceService()