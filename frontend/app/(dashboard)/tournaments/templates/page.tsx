"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";
import api from "@/lib/api";
import {
  TournamentTemplate,
  TournamentTemplateCreate,
  TournamentType,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const TYPE_LABELS: Record<TournamentType, string> = {
  round_robin: "Todos contra todos",
  knockout: "Eliminatoria",
  mixed: "Mixto",
};

const TYPE_COLORS: Record<TournamentType, string> = {
  round_robin: "bg-green-100 text-green-800",
  knockout: "bg-orange-100 text-orange-800",
  mixed: "bg-blue-100 text-blue-800",
};

const emptyForm: TournamentTemplateCreate = {
  name: "",
  type: "round_robin",
  is_home_away: false,
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  num_groups: 2,
  teams_advance_per_group: 1,
  third_place_match: false,
  final_legs: 1,
  third_place_legs: 1,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TournamentTemplateCreate>({ ...emptyForm });

  function load() {
    setLoading(true);
    api.get<TournamentTemplate[]>("/api/templates/")
      .then((r) => setTemplates(r.data))
      .catch(() => toast.error("Error al cargar plantillas"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/templates/", form);
      toast.success("Plantilla creada");
      setOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al crear plantilla");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await api.delete(`/api/templates/${id}`);
      toast.success("Plantilla eliminada");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al eliminar");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Plantillas de Torneos
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Configura formatos reutilizables para tus torneos
          </p>
        </div>
        <Button onClick={() => { setForm({ ...emptyForm }); setOpen(true); }} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando plantillas...
          </CardContent>
        ) : templates.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay plantillas registradas</p>
            <p className="text-sm">
              Haz clic en &quot;Nueva plantilla&quot; para crear la primera
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="font-bold text-gray-900 py-2 px-2">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Tipo</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Formato</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Puntos (V/E/D)</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Config. extra</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-2 px-2">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} className="hover:bg-green-50/50 transition-colors h-[34px]">
                  <TableCell className="font-bold text-gray-900 py-2 px-2">{t.name}</TableCell>
                  <TableCell className="py-2 px-2">
                    <Badge className={TYPE_COLORS[t.type]}>
                      {TYPE_LABELS[t.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-gray-700 py-2 px-2">{t.is_home_away ? "Ida y vuelta" : "Solo ida"}</TableCell>
                  <TableCell className="font-medium text-gray-700 py-2 px-2">{t.points_win}/{t.points_draw}/{t.points_loss}</TableCell>
                  <TableCell className="text-sm text-muted-foreground py-2 px-2">
                    {t.type === "mixed" && t.num_groups && t.teams_advance_per_group
                      ? `${t.num_groups} grupos, ${t.teams_advance_per_group} avanzan`
                      : ""}
                    {(t.type === "knockout" || t.type === "mixed") && (
                      <>
                        {` | Final: ${t.final_legs === 2 ? "ida/vuelta" : "1 partido"}`}
                        {t.third_place_match && ` | 3°: ${t.third_place_legs === 2 ? "ida/vuelta" : "1 partido"}`}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-2 px-2">
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Liga Municipal 2026"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de torneo</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["round_robin", "knockout", "mixed"] as TournamentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, type })}
                    className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                      form.type === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.type === "round_robin" && "Todos los equipos juegan entre si. Min. 3 equipos."}
                {form.type === "knockout" && "Eliminacion directa. El que pierde queda fuera. Min. 2 equipos."}
                {form.type === "mixed" && "Fase de grupos seguida de eliminatoria. Min. 4 equipos."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="home-away"
                checked={form.is_home_away}
                onChange={(e) => setForm({ ...form, is_home_away: e.target.checked })}
              />
              <Label htmlFor="home-away" className="cursor-pointer">Ida y vuelta</Label>
            </div>

            {(form.type === "knockout" || form.type === "mixed") && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Final y tercer puesto</Label>

                {/* Final: 1 o 2 partidos */}
                <div className="space-y-1">
                  <Label className="text-sm">Final</Label>
                  <div className="flex gap-2">
                    {[1, 2].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm({ ...form, final_legs: n })}
                        className={`flex-1 py-2 px-3 rounded-md border-2 text-sm font-medium transition-all ${
                          (form.final_legs ?? 1) === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted hover:border-primary/50"
                        }`}
                      >
                        {n === 1 ? "Un partido" : "Ida y vuelta"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tercer puesto */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="third-place"
                    checked={form.third_place_match}
                    onChange={(e) => setForm({ ...form, third_place_match: e.target.checked })}
                  />
                  <Label htmlFor="third-place" className="cursor-pointer text-sm">Partido por tercer puesto</Label>
                </div>

                {form.third_place_match && (
                  <div className="space-y-1">
                    <Label className="text-sm">Tercer puesto</Label>
                    <div className="flex gap-2">
                      {[1, 2].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm({ ...form, third_place_legs: n })}
                          className={`flex-1 py-2 px-3 rounded-md border-2 text-sm font-medium transition-all ${
                            (form.third_place_legs ?? 1) === n
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-muted hover:border-primary/50"
                          }`}
                        >
                          {n === 1 ? "Un partido" : "Ida y vuelta"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.type === "mixed" && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-1">
                  <Label>Numero de grupos</Label>
                  <Input
                    type="number"
                    min={2}
                    value={form.num_groups ?? 2}
                    onChange={(e) => setForm({ ...form, num_groups: parseInt(e.target.value) || 2 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Equipos que avanzan por grupo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.teams_advance_per_group ?? 1}
                    onChange={(e) => setForm({ ...form, teams_advance_per_group: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Total clasificados: {(form.num_groups || 2) * (form.teams_advance_per_group || 1)} (debe ser potencia de 2)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Puntuacion</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Victoria</Label>
                  <Input type="number" min={0} value={form.points_win ?? 3}
                    onChange={(e) => setForm({ ...form, points_win: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Empate</Label>
                  <Input type="number" min={0} value={form.points_draw ?? 1}
                    onChange={(e) => setForm({ ...form, points_draw: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Derrota</Label>
                  <Input type="number" min={0} value={form.points_loss ?? 0}
                    onChange={(e) => setForm({ ...form, points_loss: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Crear plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
