"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";
import api from "@/lib/api";

import {
  Tournament,
  TournamentCreate,
  TournamentTemplate,
  Team,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
  

export default function TournamentManagePage() {
    const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);

  const [fixtureMap, setFixtureMap] = useState<Record<number, boolean>>({});

  const [form, setForm] = useState<TournamentCreate>({
    name: "",
    template_id: 0,
  });

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

        // Verificar qué torneos ya tienen fixture
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

  useEffect(() => {
    loadData();
  }, []);

  async function createTournament() {
    if (!form.name || !form.template_id) {
      toast.error("Completa todos los campos");
      return;
    }

    setSaving(true);

    try {
      await api.post("/api/tournaments/", form);
      toast.success("Torneo creado");
      setOpen(false);
      setForm({ name: "", template_id: 0 });
      loadData();
    } catch {
      toast.error("Error al crear torneo");
    } finally {
      setSaving(false);
    }
  }

  async function assignTeams() {
    if (!selectedTournament || selectedTeams.length === 0) {
      toast.error("Selecciona torneo y equipos");
      return;
    }

    try {
      await api.post(`/api/tournaments/${selectedTournament}/teams`, {
        team_ids: selectedTeams,
      });

      toast.success("Equipos asignados");
      setSelectedTeams([]);
    } catch {
      toast.error("Error asignando equipos");
    }
  }

  async function deleteTournament(id: number) {
    if (!confirm("¿Estás seguro de eliminar este torneo?")) return;
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
    } catch {
      toast.error("Error generando fixture");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold">
          Gestión de Torneos
        </h1>

        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Crear torneo
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        {loading ? (
          <CardContent className="py-10 text-center">
            <Loader2 className="animate-spin mx-auto" />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Plantilla</TableHead>
                <TableHead>Acciones</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.template_id}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={() => setSelectedTournament(t.id)}
                    >
                        Asignar equipos
                    </Button>

                    {!fixtureMap[t.id] && (
                      <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateFixture(t.id)}
                      >
                          Generar fixture
                      </Button>
                    )}

                    {fixtureMap[t.id] && (
                      <>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => router.push(`/tournaments/${t.id}/fixture`)}
                        >
                            Ver fixture
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/tournaments/${t.id}/standings`)}
                        >
                            Ver posiciones
                        </Button>
                      </>
                    )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTournament(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Asignación de equipos */}
      {selectedTournament && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <h2 className="font-bold">
              Asignar equipos al torneo #{selectedTournament}
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {teams.map((team) => (
                <label key={team.id} className="flex gap-2">
                  <input
                    type="checkbox"
                    value={team.id}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);

                      setSelectedTeams((prev) =>
                        prev.includes(id)
                          ? prev.filter((x) => x !== id)
                          : [...prev, id]
                      );
                    }}
                  />
                  {team.name}
                </label>
              ))}
            </div>

            <Button onClick={assignTeams}>
              Guardar equipos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog Crear */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear torneo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Plantilla</Label>
              <select
                className="w-full border p-2"
                value={form.template_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    template_id: parseInt(e.target.value),
                  })
                }
              >
                <option value={0}>Seleccionar</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={createTournament} disabled={saving}>
              {saving && <Loader2 className="animate-spin mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}