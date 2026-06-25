import json
import numpy as np
import torch
import soundfile as sf

try:
    from speechbrain.inference.speaker import EncoderClassifier
except ImportError:
    from speechbrain.pretrained import EncoderClassifier


class VoiceService:
    def __init__(self):
        self.classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
        )

    def extract_embedding(self, audio_path: str) -> np.ndarray:
        audio, sample_rate = sf.read(audio_path)

        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        signal = torch.tensor(audio, dtype=torch.float32).unsqueeze(0)

        if sample_rate != 16000:
            import torchaudio
            resampler = torchaudio.transforms.Resample(
                orig_freq=sample_rate,
                new_freq=16000,
            )
            signal = resampler(signal)

        with torch.no_grad():
            embedding = self.classifier.encode_batch(signal)

        return embedding.squeeze().cpu().numpy().astype(float)

    def serialize_embedding(self, embedding: np.ndarray) -> str:
        return json.dumps(embedding.tolist())

    def deserialize_embedding(self, embedding_json: str) -> np.ndarray:
        return np.array(json.loads(embedding_json), dtype=float)

    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(np.dot(emb1, emb2) / (norm1 * norm2))

    def verify_voice(self, stored_embedding_json: str, audio_path: str, threshold: float = 0.65):
        stored_embedding = self.deserialize_embedding(stored_embedding_json)
        current_embedding = self.extract_embedding(audio_path)

        similarity = self.cosine_similarity(stored_embedding, current_embedding)

        return {
            "accepted": similarity >= threshold,
            "similarity": similarity,
            "threshold": threshold,
        }


voice_service = VoiceService()