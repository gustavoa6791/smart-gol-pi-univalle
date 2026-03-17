"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, X, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { Team, TeamCreate, TeamCategory, Player } from "@/lib/types";

const CATEGORY_LABELS: Record<TeamCategory, string> = {
  sub_10: "Sub-10",
  sub_12: "Sub-12",
  sub_14: "Sub-14",
  sub_16: "Sub-16",
  sub_18: "Sub-18",
  senior: "Senior",
};

const emptyForm: TeamCreate = {
  name: "",
  coach_name: "",
  category: "sub_10",
  player_ids: [],
  leader_id: undefined,
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  // Form state
  const [form, setForm] = useState<TeamCreate>(emptyForm);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  function loadTeams(silent = false) {
    if (!silent) setLoading(true);
    api.get<Team[]>("/api/teams/")
      .then((r) => {
        console.log("Equipos cargados:", r.data.length, r.data);
        setTeams(r.data);
      })
      .catch((err) => {
        console.error("Error al cargar equipos:", err);
        if (!silent) toast.error("Error al cargar equipos");
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }

  function loadPlayers() {
    api.get<Player[]>("/api/players/")
      .then((r) => setPlayers(r.data))
      .catch(() => toast.error("Error al cargar jugadores"));
  }

  useEffect(() => {
    loadTeams();
    loadPlayers();
    // Auto-refresh cada 3 segundos para ver cambios de otros usuarios (sin mostrar loading)
    const interval = setInterval(() => {
      loadTeams(true); // silent = true para no mostrar loading en el refresh automático
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  function openCreate() {
    setEditingTeam(null);
    setForm({ ...emptyForm, category: "sub_10", player_ids: [] });
    setSelectedPlayerId("");
    setFormOpen(true);
  }

  function openEdit(team: Team) {
    setEditingTeam(team);
    setForm({
      name: team.name,
      coach_name: team.coach_name,
      category: team.category,
      player_ids: team.players?.map(p => p.id) || [],
      leader_id: team.leader_id ?? undefined,
    });
    setSelectedPlayerId("");
    setFormOpen(true);
  }

  function openDelete(team: Team) {
    setDeletingTeam(team);
    setDeleteOpen(true);
  }

  function addPlayer() {
    if (!selectedPlayerId) return;
    const playerId = parseInt(selectedPlayerId);
    if (!form.player_ids?.includes(playerId)) {
      setForm({
        ...form,
        player_ids: [...(form.player_ids || []), playerId],
      });
    }
    setSelectedPlayerId("");
  }

  function removePlayer(playerId: number) {
    const newPlayerIds = form.player_ids?.filter(id => id !== playerId) || [];
    setForm({
      ...form,
      player_ids: newPlayerIds,
      leader_id: form.leader_id === playerId ? undefined : form.leader_id,
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!form.coach_name.trim()) {
      toast.error("El nombre del formador es requerido");
      return;
    }
    setSaving(true);
    const payload: TeamCreate = {
      name: form.name.trim(),
      coach_name: form.coach_name.trim(),
      category: form.category,
      player_ids: form.player_ids && form.player_ids.length > 0 ? form.player_ids : undefined,
      leader_id: form.leader_id && form.player_ids?.includes(form.leader_id) ? form.leader_id : undefined,
    };
    try {
      console.log("Enviando payload:", payload);
      let response;
      if (editingTeam) {
        response = await api.put(`/api/teams/${editingTeam.id}`, payload);
        console.log("Equipo actualizado:", response.data);
        toast.success("Equipo actualizado");
      } else {
        response = await api.post("/api/teams/", payload);
        console.log("Equipo creado:", response.data);
        toast.success("Equipo creado");
      }
      setFormOpen(false);
      loadTeams();
    } catch (err: any) {
      console.error("Error al guardar equipo:", err);
      console.error("Error response:", err?.response);
      const errorMsg = err?.response?.data?.detail || "Error al guardar";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTeam) return;
    setSaving(true);
    try {
      await api.delete(`/api/teams/${deletingTeam.id}`);
      toast.success("Equipo eliminado");
      setDeleteOpen(false);
      loadTeams();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setSaving(false);
    }
  }

  const availablePlayers = players.filter(p => !form.player_ids?.includes(p.id));
  const selectedPlayers: Player[] =
    editingTeam?.players && form.player_ids?.length
      ? form.player_ids
          .map((id) => editingTeam.players!.find((p) => p.id === id))
          .filter((p): p is Player => p != null)
      : players.filter((p) => form.player_ids?.includes(p.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Equipos
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            🏆 Gestiona los equipos del torneo
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Crear equipo
        </Button>
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando equipos...
          </CardContent>
        ) : teams.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay equipos registrados</p>
            <p className="text-sm">
              Haz clic en &quot;Crear equipo&quot; para agregar el primero
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="w-12 font-bold text-gray-900 py-4 px-4">ID</TableHead>
                <TableHead className="font-bold text-gray-900 py-4 px-4">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900 py-4 px-4">Categoría</TableHead>
                <TableHead className="font-bold text-gray-900 py-4 px-4">Formador</TableHead>
                <TableHead className="font-bold text-gray-900 py-4 px-4">Líder</TableHead>
                <TableHead className="font-bold text-gray-900 py-4 px-4">Jugadores</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-4 px-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="text-muted-foreground py-4 px-4">
                    {team.id}
                  </TableCell>
                  <TableCell className="font-bold text-gray-900 py-4 px-4">{team.name}</TableCell>
                  <TableCell className="py-4 px-4">
                    <Badge variant="secondary" className="bg-gradient-to-r from-green-400 to-green-500 text-white border-0 font-bold shadow-md px-3 py-1">
                      {CATEGORY_LABELS[team.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-gray-700 py-4 px-4">{team.coach_name}</TableCell>
                  <TableCell className="py-4 px-4">
                    {team.leader ? (
                      <Badge className="gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white border-0 font-semibold shadow-md">
                        <UserRound className="h-3 w-3" />
                        {team.leader.name} {team.leader.surname}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    {team.players && team.players.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {team.players.slice(0, 3).map((player) => (
                          <Badge 
                            key={player.id} 
                            variant="outline"
                            className="bg-gradient-to-r from-blue-400 to-blue-500 text-white border-0 font-semibold shadow-md px-2 py-1"
                          >
                            {player.name} {player.surname}
                          </Badge>
                        ))}
                        {team.players.length > 3 && (
                          <Badge variant="outline" className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-0 font-bold shadow-md px-2 py-1">
                            +{team.players.length - 3}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-4 px-4">
                    <div className="flex items-center justify-end gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-semibold shadow-sm hover:shadow-md transition-all"
                        onClick={() => openEdit(team)}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => openDelete(team)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? "Editar equipo" : "Nuevo equipo"}
            </DialogTitle>
            <DialogDescription>
              {editingTeam
                ? "Modifica los datos del equipo"
                : "Completa la información del nuevo equipo"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            {/* Name */}
            <div className="space-y-3">
              <Label htmlFor="f-name">Nombre del equipo *</Label>
              <Input
                id="f-name"
                placeholder="Ej: Los Tigres"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Coach Name */}
            <div className="space-y-3">
              <Label htmlFor="f-coach">Formador *</Label>
              <Input
                id="f-coach"
                placeholder="Ej: Juan Pérez"
                value={form.coach_name}
                onChange={(e) => setForm({ ...form, coach_name: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="space-y-3">
              <Label>Categoría *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm({ ...form, category: v as TeamCategory })
                  }
                >
                  <SelectTrigger className="border-2 border-green-300 focus:ring-green-500 focus:border-green-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub_10">Sub-10</SelectItem>
                    <SelectItem value="sub_12">Sub-12</SelectItem>
                    <SelectItem value="sub_14">Sub-14</SelectItem>
                    <SelectItem value="sub_16">Sub-16</SelectItem>
                    <SelectItem value="sub_18">Sub-18</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            {/* Players */}
            <div className="space-y-3">
              <Label>Jugadores</Label>
              <div className="flex gap-3">
                <Select
                  value={selectedPlayerId}
                  onValueChange={(value) => setSelectedPlayerId(value || "")}
                >
                  <SelectTrigger className="border-2 border-green-300 focus:ring-green-500 focus:border-green-500">
                    <SelectValue placeholder="Seleccionar jugador" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlayers.length === 0 ? (
                      <SelectItem value="" disabled>
                        No hay jugadores disponibles
                      </SelectItem>
                    ) : (
                      availablePlayers.map((player) => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} {player.surname} {player.number && `#${player.number}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPlayer}
                  disabled={!selectedPlayerId}
                  className="border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-bold shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Selected Players */}
              {selectedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPlayers.map((player) => (
                    <Badge
                      key={player.id}
                      variant="secondary"
                      className="gap-1 pr-1 bg-gradient-to-r from-blue-400 to-blue-500 text-white border-0 font-semibold shadow-md"
                    >
                      {player.name} {player.surname}
                      <button
                        type="button"
                        onClick={() => removePlayer(player.id)}
                        className="ml-1 hover:bg-red-500 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Líder del equipo (capitán/contacto) */}
            {(form.player_ids?.length ?? 0) > 0 && (
              <div className="space-y-3 pt-4 border-t border-green-200">
                <Label className="flex items-center gap-2 font-semibold text-gray-900">
                  <UserRound className="h-4 w-4 text-green-600" />
                  Líder del equipo (capitán/contacto)
                </Label>
                <Select
                  value={form.leader_id?.toString() ?? "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      leader_id: v && v !== "none" ? parseInt(v, 10) : undefined,
                    })
                  }
                >
                  <SelectTrigger className="border-2 border-green-300 focus:ring-green-500 focus:border-green-500">
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {selectedPlayers.map((player) => (
                      <SelectItem key={player.id} value={player.id.toString()}>
                        {player.name} {player.surname}
                        {player.number != null && ` #${player.number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Solo puede haber un líder por equipo. Debe estar en la lista de jugadores.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-gray-300">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTeam ? "Guardar cambios" : "Crear equipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar equipo?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará el equipo{" "}
              <strong>{deletingTeam?.name}</strong> permanentemente y no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
