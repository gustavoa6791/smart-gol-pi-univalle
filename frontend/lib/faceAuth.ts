import api from "@/lib/api";

export interface FaceVerificationResult {
  provider: "local" | "azure";
  is_identical: boolean;
  similarity?: number;
  confidence?: number;
  threshold?: number;
}

export interface FaceVerificationResponse {
  status: string;
  message: string;
  result: FaceVerificationResult;
}

export async function verifyPlayerFace(
  registeredPhoto: File,
  currentPhoto: File
): Promise<FaceVerificationResponse> {
  const formData = new FormData();

  formData.append("registered_photo", registeredPhoto);
  formData.append("current_photo", currentPhoto);

  const response = await api.post<FaceVerificationResponse>(
    "/api/face/verify-test",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}