"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { TeamCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewTeamPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TeamCreate>({
    name: "",
    coach_name: "",
  });

  const set = (field: keyof TeamCreate, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value || undefined }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error("El nombre del equipo es obligatorio");
      return;
    }
    if (!form.coach_name?.trim()) {
      toast.error("El nombre del formador es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/api/teams/", {
        name: form.name.trim(),
        coach_name: form.coach_name.trim(),
      });
      toast.success("Equipo creado correctamente");
      router.push(`/teams/${data.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Error al crear equipo";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => router.push("/teams")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">Nuevo equipo</h1>
          </div>
          <Button type="submit" disabled={saving} size="sm" className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear equipo
          </Button>
        </div>

        <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-4">
            <CardTitle>Informacion del equipo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 pt-4">
            <div className="space-y-2">
              <Label>Nombre del equipo *</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej: Los Tigres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Formador *</Label>
              <Input
                value={form.coach_name || ""}
                onChange={(e) => set("coach_name", e.target.value)}
                placeholder="Nombre del director tecnico o formador"
                required
              />
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Una vez creado el equipo podras agregar el escudo, asignar jugadores y
          designar un lider desde la pagina de detalle.
        </p>
      </form>
    </div>
  );
}
