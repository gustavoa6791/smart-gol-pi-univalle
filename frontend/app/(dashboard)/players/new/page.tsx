"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { PlayerCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
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

  const set = (field: keyof PlayerCreate, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value || undefined }));

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" type="button" onClick={() => router.push("/players")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold">Nuevo jugador</h1>
        </div>
        <Button type="submit" disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Crear jugador
        </Button>
      </div>
        {/* Nombres */}
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primer nombre *</Label>
              <Input
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Segundo nombre</Label>
              <Input
                value={form.second_name || ""}
                onChange={(e) => set("second_name", e.target.value)}
                placeholder="Carlos"
              />
            </div>
            <div className="space-y-2">
              <Label>Primer apellido *</Label>
              <Input
                value={form.first_surname}
                onChange={(e) => set("first_surname", e.target.value)}
                placeholder="García"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Segundo apellido</Label>
              <Input
                value={form.second_surname || ""}
                onChange={(e) => set("second_surname", e.target.value)}
                placeholder="López"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input
                type="date"
                value={form.birth_date || ""}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="300 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2 col-span-2">
              <Label>Dirección</Label>
              <Input
                value={form.address || ""}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Calle 123 # 45-67"
              />
            </div>
          </CardContent>
        </Card>

        {/* Documento */}
        <Card>
          <CardHeader>
            <CardTitle>Documento de identidad</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Número de documento</Label>
              <Input
                value={form.document_number || ""}
                onChange={(e) => set("document_number", e.target.value)}
                placeholder="1234567890"
              />
            </div>
          </CardContent>
        </Card>

        {/* Deportivo */}
        <Card>
          <CardHeader>
            <CardTitle>Información deportiva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                className="w-full border rounded-md p-2 text-sm min-h-[80px]"
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
