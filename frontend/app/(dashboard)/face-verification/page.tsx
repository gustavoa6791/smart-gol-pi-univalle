"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import {
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  FaceVerificationResponse,
  verifyPlayerFace,
} from "@/lib/faceAuth";

interface ApiErrorResponse {
  detail?:
    | string
    | {
        message?: string;
      };
}

export default function FaceVerificationPage() {
  const [registeredPhoto, setRegisteredPhoto] = useState<File | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<File | null>(null);

  const [registeredPreview, setRegisteredPreview] = useState<string | null>(
    null
  );
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  const [result, setResult] = useState<FaceVerificationResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (registeredPreview) {
        URL.revokeObjectURL(registeredPreview);
      }

      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
    };
  }, [registeredPreview, currentPreview]);

  function handleRegisteredPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (registeredPreview) {
      URL.revokeObjectURL(registeredPreview);
    }

    setRegisteredPhoto(file);
    setRegisteredPreview(file ? URL.createObjectURL(file) : null);
    setResult(null);
    setError("");
  }

  function handleCurrentPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    setCurrentPhoto(file);
    setCurrentPreview(file ? URL.createObjectURL(file) : null);
    setResult(null);
    setError("");
  }

  function getErrorMessage(errorValue: unknown): string {
    const axiosError = errorValue as AxiosError<ApiErrorResponse>;
    const detail = axiosError.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (detail?.message) {
      return detail.message;
    }

    return "No fue posible realizar la verificación facial.";
  }

  async function handleVerify() {
    setError("");
    setResult(null);

    if (!registeredPhoto) {
      setError("Selecciona la fotografía registrada del jugador.");
      return;
    }

    if (!currentPhoto) {
      setError("Selecciona la fotografía actual del jugador.");
      return;
    }

    try {
      setLoading(true);

      const response = await verifyPlayerFace(
        registeredPhoto,
        currentPhoto
      );

      setResult(response);
    } catch (errorValue: unknown) {
      setError(getErrorMessage(errorValue));
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    if (registeredPreview) {
      URL.revokeObjectURL(registeredPreview);
    }

    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    setRegisteredPhoto(null);
    setCurrentPhoto(null);
    setRegisteredPreview(null);
    setCurrentPreview(null);
    setResult(null);
    setError("");
  }

  const similarityPercentage =
    result?.result.similarity !== undefined
      ? Math.max(0, Math.min(100, result.result.similarity * 100))
      : null;

  const confidencePercentage =
    result?.result.confidence !== undefined
      ? Math.max(0, Math.min(100, result.result.confidence * 100))
      : null;

  const scorePercentage =
    similarityPercentage ?? confidencePercentage;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
          <ShieldCheck className="h-8 w-8 text-green-600" />
          Validación de identidad
        </h1>

        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Compara la fotografía registrada del jugador con una fotografía
          actual ante una posible sospecha de suplantación.
        </p>
      </div>

      <Card className="border-2 border-green-200 shadow-lg">
        <CardHeader>
          <CardTitle>Comparación facial</CardTitle>
          <CardDescription>
            Cada fotografía debe contener un solo rostro principal, visible y
            con buena iluminación.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PhotoSelector
              id="registered-photo"
              title="Fotografía registrada"
              description="Foto guardada previamente en el perfil del jugador."
              file={registeredPhoto}
              preview={registeredPreview}
              onChange={handleRegisteredPhoto}
            />

            <PhotoSelector
              id="current-photo"
              title="Fotografía actual"
              description="Foto tomada al jugador presente en el torneo."
              file={currentPhoto}
              preview={currentPreview}
              onChange={handleCurrentPhoto}
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={handleVerify}
              disabled={loading || !registeredPhoto || !currentPhoto}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Comparando rostros...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Validar identidad
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={clearForm}
              disabled={loading}
            >
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            result.result.is_identical
              ? "border-2 border-green-400 bg-green-50 shadow-lg"
              : "border-2 border-red-400 bg-red-50 shadow-lg"
          }
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              {result.result.is_identical ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-green-600" />

                  <div>
                    <h2 className="text-2xl font-bold text-green-800">
                      Identidad validada
                    </h2>
                    <p className="mt-1 text-sm text-green-700">
                      Las fotografías presentan una coincidencia facial.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <UserX className="h-16 w-16 text-red-600" />

                  <div>
                    <h2 className="text-2xl font-bold text-red-800">
                      Identidad no validada
                    </h2>
                    <p className="mt-1 text-sm text-red-700">
                      Las fotografías no alcanzaron el nivel mínimo de
                      similitud.
                    </p>
                  </div>
                </>
              )}

              <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <ResultValue
                  label="Proveedor"
                  value={
                    result.result.provider === "local"
                      ? "Modelo local"
                      : "Azure Face"
                  }
                />

                <ResultValue
                  label="Similitud"
                  value={
                    scorePercentage !== null
                      ? `${scorePercentage.toFixed(2)} %`
                      : "No disponible"
                  }
                />

                <ResultValue
                  label="Umbral"
                  value={
                    result.result.threshold !== undefined
                      ? `${(result.result.threshold * 100).toFixed(2)} %`
                      : "Definido por Azure"
                  }
                />
              </div>

              <p className="max-w-2xl text-xs text-muted-foreground">
                Este resultado sirve como apoyo al organizador. La decisión
                final debe incluir revisión humana y no debe basarse
                únicamente en la comparación automática.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Recomendaciones para las fotografías
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <p>• El rostro debe estar cerca y claramente visible.</p>
            <p>• Utiliza buena iluminación frontal.</p>
            <p>• Evita gafas oscuras, gorras o elementos que cubran el rostro.</p>
            <p>• Procura que no aparezcan otras personas en la imagen.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PhotoSelectorProps {
  id: string;
  title: string;
  description: string;
  file: File | null;
  preview: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function PhotoSelector({
  id,
  title,
  description,
  file,
  preview,
  onChange,
}: PhotoSelectorProps) {
  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-gray-300 p-4">
      <div>
        <Label htmlFor={id} className="text-base font-bold">
          {title}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <Input
        id={id}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        onChange={onChange}
      />

      {preview ? (
        <div className="overflow-hidden rounded-lg border bg-gray-100">
          <img
            src={preview}
            alt={title}
            className="h-72 w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-72 flex-col items-center justify-center rounded-lg bg-gray-50 text-muted-foreground">
          <Upload className="mb-3 h-10 w-10" />
          <p className="text-sm">Selecciona una fotografía</p>
        </div>
      )}

      {file && (
        <p className="truncate text-xs text-muted-foreground">
          Archivo: {file.name}
        </p>
      )}
    </div>
  );
}

interface ResultValueProps {
  label: string;
  value: string;
}

function ResultValue({ label, value }: ResultValueProps) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold text-gray-900">{value}</p>
    </div>
  );
}