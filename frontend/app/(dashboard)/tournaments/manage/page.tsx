"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  Tournament, TournamentCreate, TournamentTemplate, Team, TournamentType,
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

  const [form, setForm] = useState<TournamentCreate>({ name: "", template_id: 0 });

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
        await Promise.all(
          t.data.map(async (tour: Tournament) => {
            try {
              const res = await api.get(`/api/tournaments/${tour.id}/matches`);
              map[tour.id] = res.data.length > 0;
            } catch {
              map[tour.id] = false;
            }
          })
        );
        setFixtureMap(map);
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
    setTeamsOpen(true);
  }

  async function assignTeams() {
    if (!selectedTournament || selectedTeamIds.length === 0) {
      toast.error("Selecciona al menos un equipo");
      return;
    }
    try {
      await api.post(`/api/tournaments/${selectedTournament.id}/teams`, { team_ids: selectedTeamIds });
      toast.success("Equipos asignados");
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
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Crear torneo
        </Button>
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
                        <Button size="sm" variant="outline" onClick={() => openAssignTeams(t)}>
                          Asignar equipos
                        </Button>

                        {!hasFixture && (
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
                                Ver bracket
                              </Button>
                            )}

                            {type === "mixed" && (
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
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => deleteTournament(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar equipos a {selectedTournament?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {teams.map((team) => (
              <label key={team.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTeamIds.includes(team.id)}
                  onChange={(e) => {
                    setSelectedTeamIds((prev) =>
                      e.target.checked ? [...prev, team.id] : prev.filter((id) => id !== team.id)
                    );
                  }}
                />
                <span className="text-sm">{team.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamsOpen(false)}>Cancelar</Button>
            <Button onClick={assignTeams} disabled={selectedTeamIds.length === 0}>
              Guardar equipos ({selectedTeamIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
