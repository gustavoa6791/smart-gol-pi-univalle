"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Eye, Camera} from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Tournament, TournamentCreate, TournamentTemplate, Team, TournamentType,
} from "@/lib/types";
import { useCurrentUser, canWrite, isAdmin } from "@/lib/useCurrentUser";
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
  round_robin: "Liga",
  knockout: "Eliminatoria",
  mixed: "Mixto",
};

const TYPE_COLORS: Record<TournamentType, string> = {
  round_robin: "bg-green-100 text-green-800",
  knockout: "bg-orange-100 text-orange-800",
  mixed: "bg-blue-100 text-blue-800",
};

export default function TournamentManagePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const writeAllowed = canWrite(user?.role);
  const adminAllowed = isAdmin(user?.role);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [fixtureMap, setFixtureMap] = useState<Record<number, boolean>>({});
  const [teamsCountMap, setTeamsCountMap] = useState<Record<number, number>>({});
  const [advancedMap, setAdvancedMap] = useState<Record<number, boolean>>({});

  const [form, setForm] = useState<TournamentCreate>({ name: "", template_id: 0 });

  const [ocrLoading, setOcrLoading] = useState(false);
  const [proposedTeams, setProposedTeams] = useState<any[]>([]);
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"manual" | "ocr_results">("manual");

  function loadData() {
    setLoading(true);
    Promise.all([
      api.get<Tournament[]>("/api/tournaments/"),
      api.get<TournamentTemplate[]>("/api/templates/"),
      api.get<Team[]>("/api/teams/"),
    ])
      .then(async ([t, temp, team]) => {
        setTournaments(t.data);
        setTemplates(temp.data);
        setTeams(team.data);

        const map: Record<number, boolean> = {};
        const teamCounts: Record<number, number> = {};
        const advanced: Record<number, boolean> = {};
        await Promise.all(
          t.data.map(async (tour: Tournament) => {
            try {
              const [mRes, tmRes] = await Promise.all([
                api.get(`/api/tournaments/${tour.id}/matches`),
                api.get(`/api/tournaments/${tour.id}/teams`),
              ]);
              map[tour.id] = mRes.data.length > 0;
              teamCounts[tour.id] = tmRes.data.length;
              advanced[tour.id] = mRes.data.some(
                (m: { phase?: string | null; home_team?: { id: number } | null }) =>
                  m.phase && m.phase !== "group" && m.home_team != null
              );
            } catch {
              map[tour.id] = false;
              teamCounts[tour.id] = 0;
              advanced[tour.id] = false;
            }
          })
        );
        setFixtureMap(map);
        setTeamsCountMap(teamCounts);
        setAdvancedMap(advanced);
      })
      .catch(() => toast.error("Error cargando datos"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function createTournament() {
    if (!form.name || !form.template_id) {
      toast.error("Completa todos los campos");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/tournaments/", form);
      toast.success("Torneo creado");
      setCreateOpen(false);
      setForm({ name: "", template_id: 0 });
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al crear torneo");
    } finally {
      setSaving(false);
    }
  }

  function openAssignTeams(t: Tournament) {
    setSelectedTournament(t);
    setSelectedTeamIds([]);
    setProposedTeams([]);
    setUnmatchedLines([]);
    setViewMode("manual"); // Inicia por defecto en modo manual
    setTeamsOpen(true);
  }

  async function handleOcrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedTournament) return;

    const formData = new FormData();
    formData.append("file", file);

    setOcrLoading(true);
    try {
      const res = await api.post(`/api/tournaments/${selectedTournament.id}/teams/detect-ocr`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { proposed_teams, unmatched_lines, message } = res.data;

      if (proposed_teams.length === 0) {
        toast.info(message || "No se reconocieron equipos del sistema en la imagen.");
      } else {
        toast.success(`Se detectaron ${proposed_teams.length} posibles equipos.`);
      }

      setProposedTeams(proposed_teams);
      setUnmatchedLines(unmatched_lines || []);
      
      // Auto-seleccionar los equipos propuestos que NO estén ya asignados al torneo
      const newTeamIds = proposed_teams
        .filter((pt: any) => !pt.already_in_tournament)
        .map((pt: any) => pt.id);

      setSelectedTeamIds(newTeamIds);
      setViewMode("ocr_results"); // Cambia la vista para mostrar las sugerencias
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al procesar la imagen con Azure OCR");
    } finally {
      setOcrLoading(false);
      // Limpiar el input para permitir volver a subir el mismo archivo si es necesario
      e.target.value = "";
    }
  }

  async function assignTeams() {
    if (!selectedTournament || selectedTeamIds.length === 0) {
      toast.error("Selecciona al menos un equipo");
      return;
    }
    try {
      await api.post(`/api/tournaments/${selectedTournament.id}/teams`, { team_ids: selectedTeamIds });
      toast.success("Equipos asignados");
      setTeamsCountMap((prev) => ({
        ...prev,
        [selectedTournament.id]: (prev[selectedTournament.id] || 0) + selectedTeamIds.length,
      }));
      setTeamsOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error asignando equipos");
    }
  }

  async function deleteTournament(id: number) {
    if (!confirm("¿Eliminar este torneo y todos sus partidos?")) return;
    try {
      await api.delete(`/api/tournaments/${id}`);
      toast.success("Torneo eliminado");
      loadData();
    } catch {
      toast.error("Error al eliminar torneo");
    }
  }

  async function generateFixture(id: number) {
    try {
      const res = await api.post(`/api/tournaments/${id}/generate-fixture`);
      toast.success(`Fixture generado (${res.data.total_matches} partidos)`);
      setFixtureMap((prev) => ({ ...prev, [id]: true }));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error generando fixture");
    }
  }

  async function advanceToKnockout(id: number) {
    try {
      const res = await api.post(`/api/tournaments/${id}/advance-to-knockout`);
      toast.success(res.data.message);
      setAdvancedMap((prev) => ({ ...prev, [id]: true }));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al avanzar a eliminatoria");
    }
  }

  function getType(t: Tournament): TournamentType {
    return t.template?.type || "round_robin";
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Gestion de Torneos
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Crea y administra los torneos
          </p>
        </div>
        {writeAllowed && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            <Plus className="h-4 w-4" />
            Crear torneo
          </Button>
        )}
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando torneos...
          </CardContent>
        ) : tournaments.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay torneos registrados</p>
            <p className="text-sm">
              Haz clic en &quot;Crear torneo&quot; para agregar el primero
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="font-bold text-gray-900 py-2 px-2">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Tipo</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Plantilla</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Acciones</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-2 px-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map((t) => {
                const type = getType(t);
                const hasFixture = fixtureMap[t.id];
                const hasTeams = (teamsCountMap[t.id] || 0) > 0;
                return (
                  <TableRow key={t.id} className="hover:bg-green-50/50 transition-colors h-[34px]">
                    <TableCell className="font-bold text-gray-900 py-2 px-2">{t.name}</TableCell>
                    <TableCell className="py-2 px-2">
                      <Badge className={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-gray-700 py-2 px-2">
                      {t.template?.name || `#${t.template_id}`}
                    </TableCell>
                    <TableCell className="py-2 px-2">
                      <div className="flex flex-wrap gap-2">
                        {!hasTeams && writeAllowed && (
                          <Button size="sm" variant="outline" onClick={() => openAssignTeams(t)}>
                            Asignar equipos
                          </Button>
                        )}

                        {!hasFixture && writeAllowed && (
                          <Button size="sm" variant="outline" onClick={() => generateFixture(t.id)}>
                            Generar fixture
                          </Button>
                        )}

                        {hasFixture && (
                          <>
                            <Button size="sm" variant="secondary"
                              onClick={() => router.push(`/tournaments/${t.id}/fixture`)}>
                              Ver fixture
                            </Button>

                            {(type === "round_robin" || type === "mixed") && (
                              <Button size="sm" variant="outline"
                                onClick={() => router.push(`/tournaments/${t.id}/standings`)}>
                                Posiciones
                              </Button>
                            )}

                            {(type === "knockout" || type === "mixed") && (
                              <Button size="sm" variant="outline"
                                onClick={() => router.push(`/tournaments/${t.id}/bracket`)}>
                                Ver eliminatorias
                              </Button>
                            )}

                            <Button size="sm" variant="outline"
                              onClick={() => router.push(`/tournaments/${t.id}/scorers`)}>
                              Goleadores
                            </Button>

                            {type === "mixed" && !advancedMap[t.id] && writeAllowed && (
                              <Button size="sm" variant="outline"
                                onClick={() => advanceToKnockout(t.id)}>
                                Avanzar a eliminatoria
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-2 px-2">
                      {adminAllowed && (
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => deleteTournament(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog crear torneo */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear torneo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Plantilla</Label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: parseInt(e.target.value) })}
              >
                <option value={0}>Seleccionar</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {TYPE_LABELS[t.type]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createTournament} disabled={saving}>
              {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog asignar equipos */}
      <Dialog open={teamsOpen} onOpenChange={setTeamsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 pr-6">
            <div>
              <DialogTitle>Asignar equipos a {selectedTournament?.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selecciona manualmente o sube una captura/foto de la lista de inscritos.
              </p>
            </div>
            
            {/* Botón OCR camuflado como Input de Archivos */}
            <div className="relative">
              <input
                type="file"
                id="ocr-file-input"
                accept="image/*"
                className="hidden"
                onChange={handleOcrUpload}
                disabled={ocrLoading}
              />
              <Button
                size="sm"
                variant={viewMode === "ocr_results" ? "default" : "outline"}
                className="gap-1.5 border-green-600 text-green-700 hover:bg-green-50"
              >
                <label htmlFor="ocr-file-input" className="cursor-pointer">
                  {ocrLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-green-700" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-green-700" />
                  )}
                  {ocrLoading ? "Procesando..." : "Escanear Lista"}
                </label>
              </Button>
            </div>
          </DialogHeader>

          {/* Selector de Pestañas Interno */}
          {proposedTeams.length > 0 && (
            <div className="flex gap-2 border-b pb-2 text-xs">
              <button
                type="button"
                className={`px-3 py-1 rounded font-medium ${viewMode === "manual" ? "bg-green-100 text-green-800" : "text-muted-foreground"}`}
                onClick={() => setViewMode("manual")}
              >
                Todos los equipos ({teams.length})
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded font-medium ${viewMode === "ocr_results" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}
                onClick={() => setViewMode("ocr_results")}
              >
                Sugeridos por IA/OCR ({proposedTeams.length})
              </button>
            </div>
          )}

          {/* VISTA 1: Resultados del Escaneo Inteligente (Azure Vision) */}
          {viewMode === "ocr_results" && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700 mb-2">Equipos identificados en la imagen:</p>
                <div className="space-y-2">
                  {proposedTeams.map((pt) => (
                    <div key={pt.id} className="flex items-center justify-between p-2 rounded bg-white border shadow-sm">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          disabled={pt.already_in_tournament}
                          checked={selectedTeamIds.includes(pt.id) || pt.already_in_tournament}
                          onChange={(e) => {
                            setSelectedTeamIds((prev) =>
                              e.target.checked ? [...prev, pt.id] : prev.filter((id) => id !== pt.id)
                            );
                          }}
                          className="rounded text-green-600 focus:ring-green-500"
                        />
                        <div className="flex items-center gap-2">
                          {pt.shield_url && (
                            <img src={pt.shield_url} alt="" className="w-5 h-5 object-contain" />
                          )}
                          <span className={`text-sm font-medium ${pt.already_in_tournament ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {pt.name}
                          </span>
                          {pt.category && <Badge variant="outline" className="text-[10px] py-0">{pt.category}</Badge>}
                        </div>
                      </label>
                      {pt.already_in_tournament && (
                        <Badge variant="secondary" className="text-[10px] bg-gray-200 text-gray-700">Ya está en el torneo</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Advertencias de líneas que no coincidieron de forma difusa */}
              {unmatchedLines.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1">Texto en la imagen no asignado:</p>
                  <ul className="list-disc pl-4 text-[11px] text-amber-700 space-y-0.5">
                    {unmatchedLines.slice(0, 5).map((line, idx) => (
                      <li key={idx} className="truncate">“{line}”</li>
                    ))}
                    {unmatchedLines.length > 5 && (
                      <li className="font-medium">y {unmatchedLines.length - 5} líneas más...</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: Selección Manual Convencional */}
          {viewMode === "manual" && (
            <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer border border-transparent hover:border-gray-200 transition-all">
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => {
                      setSelectedTeamIds((prev) =>
                        e.target.checked ? [...prev, team.id] : prev.filter((id) => id !== team.id)
                      );
                    }}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{team.name}</span>
                </label>
              ))}
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setTeamsOpen(false)}>Cancelar</Button>
            <Button 
              onClick={assignTeams} 
              disabled={selectedTeamIds.length === 0}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              Guardar equipos ({selectedTeamIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
