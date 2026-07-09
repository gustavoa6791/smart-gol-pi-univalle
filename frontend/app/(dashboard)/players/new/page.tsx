"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import type { PlayerCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Loader2, Mic, Square, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";

const POSITIONS = [
  { value: "goalkeeper", label: "Portero" },
  { value: "defender", label: "Defensa" },
  { value: "midfielder", label: "Mediocampista" },
  { value: "forward", label: "Delantero" },
];

const DOC_TYPES = [
  { value: "CC", label: "Cédula de Ciudadanía (CC)" },
  { value: "TI", label: "Tarjeta de Identidad (TI)" },
  { value: "CE", label: "Cédula de Extranjería (CE)" },
  { value: "PA", label: "Pasaporte (PA)" },
];

const FIELD_LABELS: Record<string, string> = {
  first_name: "Primer nombre",
  second_name: "Segundo nombre",
  first_surname: "Primer apellido",
  second_surname: "Segundo apellido",
  document_type: "Tipo de documento",
  document_number: "Número de documento",
  position: "Posición",
  birth_date: "Fecha de nacimiento",
  phone: "Teléfono",
  email: "Correo",
  address: "Dirección",
  gender: "Género",
  notes: "Notas",
};

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : ""))
      .filter(Boolean);
    if (msgs.length) return msgs.join(". ");
  }
  return fallback;
}

export default function NewPlayerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlayerCreate>({
    first_name: "",
    second_name: "",
    first_surname: "",
    second_surname: "",
    document_type: undefined,
    document_number: "",
    position: undefined,
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    gender: undefined,
    notes: "",
  });

  // ── Estado del dictado por voz (STT) ──────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [recognized, setRecognized] = useState<Set<string>>(new Set());
  const recognizerRef = useRef<{ stopContinuousRecognitionAsync: (cb: () => void, err: (e: unknown) => void) => void; close: () => void } | null>(null);
  const transcriptRef = useRef("");
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Estado del escaneo OCR (cédula) ───────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [ocrText, setOcrText] = useState("");

  const set = (field: keyof PlayerCreate, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || undefined }));
    // Si el usuario corrige a mano un campo que llenó la voz, le quitamos el resaltado.
    setRecognized((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  // Resaltado verde para campos rellenados por voz u OCR (aún sin revisar)
  const voiceClass = (field: keyof PlayerCreate) =>
    recognized.has(field) ? "ring-2 ring-green-400 bg-green-50/60" : "";

  function applyExtractedFields(
    fields: Partial<PlayerCreate>,
    source: "voz" | "cédula"
  ) {
    const keys = Object.keys(fields);
    setForm((prev) => ({ ...prev, ...fields }));
    setRecognized(new Set(keys));

    if (keys.length === 0) {
      toast.warning(
        source === "cédula"
          ? "No reconocí ningún campo en la imagen. Prueba con un pantallazo más nítido."
          : "No reconocí ningún campo. Revisa la transcripción e intenta otra vez."
      );
    } else {
      const missing = ["first_name", "first_surname"].filter((k) => !keys.includes(k));
      toast.success(
        `Reconocí ${keys.length} campo(s) desde ${source === "cédula" ? "la cédula" : "el dictado"}: ` +
          `${keys.map((k) => FIELD_LABELS[k] ?? k).join(", ")}` +
          (missing.length
            ? `. Falta(n): ${missing.map((k) => FIELD_LABELS[k]).join(", ")}`
            : ". Revisa y corrige antes de guardar.")
      );
    }
  }

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setOcrText("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await api.post("/api/players/extract-document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const fields = (data.fields ?? {}) as Partial<PlayerCreate>;
      if (data.raw_text) setOcrText(data.raw_text);
      if (data.message && Object.keys(fields).length === 0) {
        toast.warning(data.message);
      }
      applyExtractedFields(fields, "cédula");
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Error al leer la cédula. Revisa la configuración de Azure Vision."));
    } finally {
      setScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function startListening() {
    try {
      const { data } = await api.get("/api/speech/token");
      const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");

      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
        data.token,
        data.region
      );
      speechConfig.speechRecognitionLanguage = "es-CO";

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      transcriptRef.current = "";
      setLiveText("");

      recognizer.recognizing = (_s, e) => {
        setLiveText((transcriptRef.current + " " + e.result.text).trim());
      };
      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          transcriptRef.current = (transcriptRef.current + " " + e.result.text).trim();
          setLiveText(transcriptRef.current);
        }
      };
      recognizer.canceled = (_s, e) => {
        toast.error("Reconocimiento cancelado: " + (e.errorDetails || "revisa el micrófono"));
        stopListening();
      };

      recognizer.startContinuousRecognitionAsync(
        () => setListening(true),
        (err) => {
          toast.error("No se pudo iniciar el micrófono");
          console.error(err);
        }
      );
      recognizerRef.current = recognizer as unknown as typeof recognizerRef.current;
    } catch (err) {
      console.error(err);
      toast.error("No se pudo iniciar el dictado (¿permiso de micrófono?)");
      setListening(false);
    }
  }

  async function stopListening() {
    const recognizer = recognizerRef.current;
    setListening(false);
    if (recognizer) {
      await new Promise<void>((resolve) =>
        recognizer.stopContinuousRecognitionAsync(
          () => resolve(),
          () => resolve()
        )
      );
      recognizer.close();
      recognizerRef.current = null;
    }

    const text = transcriptRef.current.trim();
    if (!text) {
      toast("No se captó audio. Intenta de nuevo.");
      return;
    }

    setProcessing(true);
    try {
      const { data } = await api.post("/api/players/extract", { text });
      const fields = (data.fields ?? {}) as Partial<PlayerCreate>;
      applyExtractedFields(fields, "voz");
    } catch {
      toast.error("Error al procesar la transcripción");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.first_surname) {
      toast.error("Primer nombre y primer apellido son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "" && v !== undefined)
      );
      const { data } = await api.post("/api/players/", payload);
      toast.success("Jugador creado correctamente");
      router.push(`/players/${data.id}`);
    } catch {
      toast.error("Error al crear jugador");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" type="button" onClick={() => router.push("/players")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Nuevo jugador</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Botón de dictado por voz */}
          <Button
            type="button"
            size="sm"
            onClick={listening ? stopListening : startListening}
            disabled={processing}
            className={`gap-2 font-bold shadow-lg transition-all ${
              listening
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-white text-green-700 border-2 border-green-500 hover:bg-green-50"
            }`}
            title={listening ? "Parar y rellenar el formulario" : "Dictar los datos del jugador"}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : listening ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {processing ? "Procesando…" : listening ? "Listo" : "Dictar"}
          </Button>
          <Button type="submit" disabled={saving} size="sm" className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear jugador
          </Button>
        </div>
      </div>

        {/* Banner de transcripción en vivo / OCR */}
        {(listening || processing || liveText || scanning || ocrText) && (
          <div className="rounded-lg border-2 border-green-300 bg-green-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-green-800">
              {scanning ? (
                <><ScanLine className="h-4 w-4 animate-pulse" /> Leyendo la cédula con Azure Vision…</>
              ) : listening ? (
                <><Mic className="h-4 w-4 animate-pulse" /> Escuchando… (di nombre, posición, cédula, fecha de nacimiento, teléfono…)</>
              ) : processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Procesando lo que dijiste…</>
              ) : ocrText ? (
                "Texto detectado en la cédula"
              ) : (
                "Transcripción"
              )}
            </div>
            <p className="mt-1 italic text-green-900 min-h-[1.25rem] whitespace-pre-wrap max-h-40 overflow-y-auto">
              {scanning
                ? "Analizando imagen…"
                : ocrText || liveText || "Habla con naturalidad; al terminar pulsa “Listo”. O sube un pantallazo/foto de la cédula."}
            </p>
          </div>
        )}

        {/* Escanear cédula — al inicio para llenar nombres, documento, fecha, género, etc. */}
        <Card className="shadow-xl border-2 border-green-300 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-100 to-green-200 py-4">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Leer cédula con Azure Vision
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sube un pantallazo o una foto de la cédula. Se llenarán automáticamente nombres, apellidos,
              tipo y número de documento, fecha de nacimiento y género.
              <span className="block mt-1 text-green-800/80">
                Tip: incluye frente y reverso en la misma imagen para fecha de nacimiento y sexo.
              </span>
            </p>
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
              className="hidden"
              onChange={handleOcrUpload}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleOcrUpload}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={scanning || listening || processing}
                className="gap-2 border-green-500 text-green-700 hover:bg-green-100 font-semibold"
                onClick={() => ocrInputRef.current?.click()}
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {scanning ? "Leyendo imagen…" : "Subir imagen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={scanning || listening || processing}
                className="gap-2 border-green-500 text-green-700 hover:bg-green-100 font-semibold"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Tomar foto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Nombres */}
        <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Label>Primer nombre *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                placeholder="Juan"
                required
                className={voiceClass("first_name")}
              />
            </div>
            <div className="space-y-2">
              <Label>Segundo nombre</Label>
              <Input
                value={form.second_name || ""}
                onChange={(e) => set("second_name", e.target.value)}
                placeholder="Carlos"
                className={voiceClass("second_name")}
              />
            </div>
            <div className="space-y-2">
              <Label>Primer apellido *</Label>
              <Input
                value={form.first_surname}
                onChange={(e) => set("first_surname", e.target.value)}
                placeholder="García"
                required
                className={voiceClass("first_surname")}
              />
            </div>
            <div className="space-y-2">
              <Label>Segundo apellido</Label>
              <Input
                value={form.second_surname || ""}
                onChange={(e) => set("second_surname", e.target.value)}
                placeholder="López"
                className={voiceClass("second_surname")}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input
                type="date"
                value={form.birth_date || ""}
                onChange={(e) => set("birth_date", e.target.value)}
                className={voiceClass("birth_date")}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="300 123 4567"
                className={voiceClass("phone")}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                className={voiceClass("email")}
              />
            </div>
            <div className="space-y-2">
              <Label>Género</Label>
              <select
                className={`w-full border rounded-md p-2 text-sm ${voiceClass("gender")}`}
                value={form.gender || ""}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Dirección</Label>
              <Input
                value={form.address || ""}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Calle 123 # 45-67"
                className={voiceClass("address")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Documento */}
        <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
            <CardTitle>Documento de identidad</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <select
                className={`w-full border rounded-md p-2 text-sm ${voiceClass("document_type")}`}
                value={form.document_type || ""}
                onChange={(e) => set("document_type", e.target.value)}
              >
                <option value="">Seleccionar</option>
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Número de documento</Label>
              <Input
                value={form.document_number || ""}
                onChange={(e) => set("document_number", e.target.value)}
                placeholder="1234567890"
                className={voiceClass("document_number")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Deportivo */}
        <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
            <CardTitle>Información deportiva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Posición</Label>
              <select
                className={`w-full border rounded-md p-2 text-sm ${voiceClass("position")}`}
                value={form.position || ""}
                onChange={(e) => set("position", e.target.value)}
              >
                <option value="">Seleccionar</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                className={`w-full border rounded-md p-2 text-sm min-h-[80px] ${voiceClass("notes")}`}
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Observaciones adicionales..."
              />
            </div>
          </CardContent>
        </Card>

      </form>
    </div>
  );
}
