from pathlib import Path

import cv2
import numpy as np
from fastapi import HTTPException


class LocalFaceService:
    COSINE_THRESHOLD = 0.363

    def __init__(self) -> None:
        models_dir = Path(__file__).resolve().parent.parent / "face_models"

        detector_path = models_dir / "face_detection_yunet_2023mar.onnx"
        recognizer_path = models_dir / "face_recognition_sface_2021dec.onnx"

        if not detector_path.exists():
            raise RuntimeError(
                f"No se encontró el modelo de detección facial: {detector_path}"
            )

        if not recognizer_path.exists():
            raise RuntimeError(
                f"No se encontró el modelo de reconocimiento facial: "
                f"{recognizer_path}"
            )

        self.detector = cv2.FaceDetectorYN.create(
            str(detector_path),
            "",
            (320, 320),
            0.6,
            0.3,
            5000,
        )

        self.recognizer = cv2.FaceRecognizerSF.create(
            str(recognizer_path),
            "",
        )

    @staticmethod
    def _decode_image(image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="La imagen está vacía.",
            )

        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(
                status_code=400,
                detail="No se pudo leer la imagen. Usa JPG, JPEG o PNG.",
            )

        return image

    def _detect_single_face(
        self,
        image: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        height, width = image.shape[:2]

        # Reduce imágenes grandes para mejorar la detección y el rendimiento.
        max_dimension = 1280
        scale = min(1.0, max_dimension / max(width, height))

        if scale < 1.0:
            resized_width = max(1, int(width * scale))
            resized_height = max(1, int(height * scale))

            processed_image = cv2.resize(
                image,
                (resized_width, resized_height),
                interpolation=cv2.INTER_AREA,
            )
        else:
            processed_image = image

        processed_height, processed_width = processed_image.shape[:2]

        self.detector.setInputSize(
            (processed_width, processed_height)
        )

        _, faces = self.detector.detect(processed_image)

        if faces is None or len(faces) == 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No se detectó ningún rostro. Usa una fotografía de frente, "
                    "con buena iluminación y el rostro más cerca de la cámara."
                ),
            )

        # Selecciona el rostro más grande para ignorar personas del fondo.
        face = max(
            faces,
            key=lambda item: float(item[2] * item[3]),
        )

        return processed_image, face

    def _extract_feature(self, image_bytes: bytes) -> np.ndarray:
        image = self._decode_image(image_bytes)
        processed_image, face = self._detect_single_face(image)

        try:
            aligned_face = self.recognizer.alignCrop(processed_image, face)
            feature = self.recognizer.feature(aligned_face)
        except cv2.error as exc:
            raise HTTPException(
                status_code=400,
                detail=f"No fue posible procesar el rostro: {exc}",
            ) from exc

        return feature

    def verify_faces(
        self,
        image1_bytes: bytes,
        image2_bytes: bytes,
    ) -> dict:
        feature1 = self._extract_feature(image1_bytes)
        feature2 = self._extract_feature(image2_bytes)

        try:
            similarity = float(
                self.recognizer.match(
                    feature1,
                    feature2,
                    cv2.FaceRecognizerSF_FR_COSINE,
                )
            )
        except cv2.error as exc:
            raise HTTPException(
                status_code=400,
                detail=f"No fue posible comparar los rostros: {exc}",
            ) from exc

        return {
            "provider": "local",
            "is_identical": similarity >= self.COSINE_THRESHOLD,
            "similarity": round(similarity, 6),
            "threshold": self.COSINE_THRESHOLD,
        }


local_face_service = LocalFaceService()


