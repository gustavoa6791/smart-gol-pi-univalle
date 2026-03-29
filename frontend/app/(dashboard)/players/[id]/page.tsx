"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Player, PlayerDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Upload,
  FileText,
  X,
  Camera,
} from "lucide-react";
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

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PlayerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Player>>({});

  useEffect(() => {
    api
      .get<Player>(`/api/players/${id}`)
      .then((r) => {
        setPlayer(r.data);
        setForm(r.data);
      })
      .catch(() => toast.error("Error al cargar jugador"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: keyof Player, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value || undefined }));

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.first_name || !form.first_surname) {
      toast.error("Primer nombre y primer apellido son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/api/players/${id}`, {
        first_name: form.first_name,
        second_name: form.second_name || null,
        first_surname: form.first_surname,
        second_surname: form.second_surname || null,
        document_type: form.document_type || null,
        document_number: form.document_number || null,
        position: form.position || null,
        birth_date: form.birth_date || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        gender: form.gender || null,
        notes: form.notes || null,
      });
      setPlayer(data);
      toast.success("Cambios guardados");
    } catch {
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estás seguro de eliminar este jugador?")) return;
    setDeleting(true);
    try {
      await api.delete(`/api/players/${id}`);
      toast.success("Jugador eliminado");
      router.push("/players");
    } catch {
      toast.error("Error al eliminar jugador");
    } finally {
      setDeleting(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/api/players/${id}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPlayer(data);
      toast.success("Foto actualizada");
    } catch {
      toast.error("Error al subir foto");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto() {
    if (!confirm("¿Eliminar foto del jugador?")) return;
    try {
      const { data } = await api.delete(`/api/players/${id}/photo`);
      setPlayer(data);
      toast.success("Foto eliminada");
    } catch {
      toast.error("Error al eliminar foto");
    }
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/api/players/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPlayer(data);
      toast.success("Documento subido");
    } catch {
      toast.error("Error al subir documento");
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function handleDeleteDoc(docId: number) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      const { data } = await api.delete(`/api/players/${id}/documents/${docId}`);
      setPlayer(data);
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar documento");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!player) return null;

  const fullName = [player.first_name, player.second_name, player.first_surname, player.second_surname]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/players")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold truncate bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">{fullName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" form="player-form" disabled={saving} size="sm" className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Foto */}
        <Card className="col-span-1 shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
            <CardTitle className="text-sm">Foto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <div className="w-60 h-60 rounded-full overflow-hidden bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center border-2 border-green-200 shadow-md">
              {player.photo_url ? (
                <img
                  src={`${BACKEND}${player.photo_url}`}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {player.photo_url ? "Cambiar" : "Subir foto"}
            </Button>
            {player.photo_url && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive"
                onClick={handleDeletePhoto}
              >
                <X className="h-4 w-4 mr-1" />
                Eliminar foto
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Formulario */}
        <form id="player-form" onSubmit={handleSave} className="col-span-2 space-y-4">
          <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
              <CardTitle>Datos personales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-1">
                <Label>Primer nombre *</Label>
                <Input
                  value={form.first_name || ""}
                  onChange={(e) => set("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Segundo nombre</Label>
                <Input
                  value={form.second_name || ""}
                  onChange={(e) => set("second_name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Primer apellido *</Label>
                <Input
                  value={form.first_surname || ""}
                  onChange={(e) => set("first_surname", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Segundo apellido</Label>
                <Input
                  value={form.second_surname || ""}
                  onChange={(e) => set("second_surname", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={form.birth_date || ""}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Género</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={form.gender || ""}
                  onChange={(e) => set("gender", e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Dirección</Label>
                <Input
                  value={form.address || ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo de documento</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={form.document_type || ""}
                  onChange={(e) => set("document_type", e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Número de documento</Label>
                <Input
                  value={form.document_number || ""}
                  onChange={(e) => set("document_number", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Posición</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={form.position || ""}
                  onChange={(e) => set("position", e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Notas</Label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[70px]"
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

        </form>
      </div>

      {/* Documentos */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-green-50 to-green-100 py-4">
          <CardTitle>Documentos</CardTitle>
          <div>
            <input
              ref={docInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleDocUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-semibold shadow-sm hover:shadow-md transition-all"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc}
            >
              {uploadingDoc ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Subir documento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {!player.documents || player.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay documentos subidos
            </p>
          ) : (
            <div className="space-y-2">
              {player.documents.map((doc: PlayerDocument) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <a
                      href={`${BACKEND}${doc.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate hover:underline text-primary"
                    >
                      {doc.original_name}
                    </a>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    onClick={() => handleDeleteDoc(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
