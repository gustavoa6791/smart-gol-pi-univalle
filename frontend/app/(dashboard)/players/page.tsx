"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Player, PlayerCreate, PlayerPosition } from "@/lib/types";

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const POSITION_LABELS: Record<PlayerPosition, string> = {
  goalkeeper: "Portero",
  defender: "Defensa",
  midfielder: "Mediocampista",
  forward: "Delantero",
};

const POSITION_VARIANTS: Record<PlayerPosition, "default" | "secondary" | "outline"> = {
  goalkeeper: "default",
  defender: "secondary",
  midfielder: "outline",
  forward: "default",
};

const emptyForm: PlayerCreate = {
  name: "",
  surname: "",
  number: undefined,
  position: undefined,
  nationality: "",
  birth_date: undefined,
  phone: "",
  notes: "",
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);

  // Form state
  const [form, setForm] = useState<PlayerCreate>(emptyForm);

  function loadPlayers() {
    setLoading(true);
    api.get<Player[]>("/api/players/")
      .then((r) => setPlayers(r.data))
      .catch(() => toast.error("Error al cargar jugadores"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  function openCreate() {
    setEditingPlayer(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(player: Player) {
    setEditingPlayer(player);
    setForm({
      name: player.name,
      surname: player.surname ?? "",
      number: player.number,
      position: player.position,
      nationality: player.nationality ?? "",
      birth_date: player.birth_date ?? undefined,
      phone: player.phone ?? "",
      notes: player.notes ?? "",
    });
    setFormOpen(true);
  }

  function openDelete(player: Player) {
    setDeletingPlayer(player);
    setDeleteOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSaving(true);
    const payload: PlayerCreate = {
      name: form.name,
      surname: form.surname || undefined,
      number: form.number || undefined,
      position: form.position || undefined,
      nationality: form.nationality || undefined,
      birth_date: form.birth_date || undefined,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editingPlayer) {
        await api.put(`/api/players/${editingPlayer.id}`, payload);
        toast.success("Jugador actualizado");
      } else {
        await api.post("/api/players/", payload);
        toast.success("Jugador creado");
      }
      setFormOpen(false);
      loadPlayers();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingPlayer) return;
    setSaving(true);
    try {
      await api.delete(`/api/players/${deletingPlayer.id}`);
      toast.success("Jugador eliminado");
      setDeleteOpen(false);
      loadPlayers();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Jugadores
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">
            ⚽ Gestiona el listado de jugadores del equipo
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Crear jugador
        </Button>
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando jugadores...
          </CardContent>
        ) : players.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay jugadores registrados</p>
            <p className="text-sm">
              Haz clic en &quot;Crear jugador&quot; para agregar el primero
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="w-12 font-bold text-gray-900">#</TableHead>
                <TableHead className="font-bold text-gray-900">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900">Dorsal</TableHead>
                <TableHead className="font-bold text-gray-900">Posición</TableHead>
                <TableHead className="font-bold text-gray-900">Nacionalidad</TableHead>
                <TableHead className="font-bold text-gray-900">Edad</TableHead>
                <TableHead className="font-bold text-gray-900">Teléfono</TableHead>
                <TableHead className="text-right font-bold text-gray-900">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="text-muted-foreground">
                    {player.id}
                  </TableCell>
                  <TableCell className="font-bold text-gray-900">
                    {player.name} {player.surname}
                  </TableCell>
                  <TableCell>
                    {player.number ? (
                      <Badge variant="secondary" className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-0 font-bold text-sm shadow-md px-3 py-1">
                        #{player.number}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {player.position ? (
                      <Badge 
                        variant={POSITION_VARIANTS[player.position]}
                        className="bg-gradient-to-r from-green-400 to-green-500 text-white border-0 font-bold shadow-md px-3 py-1"
                      >
                        {POSITION_LABELS[player.position]}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-700">{player.nationality || "—"}</TableCell>
                  <TableCell className="text-gray-700">{formatDate(player.birth_date)}</TableCell>
                  <TableCell className="text-gray-700">{player.phone || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-semibold shadow-sm hover:shadow-md transition-all"
                        onClick={() => openEdit(player)}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={() => openDelete(player)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlayer ? "Editar jugador" : "Nuevo jugador"}
            </DialogTitle>
            <DialogDescription>
              {editingPlayer
                ? "Modifica los datos del jugador"
                : "Completa la información del nuevo jugador"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="f-name">Nombre *</Label>
              <Input
                id="f-name"
                placeholder="Nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Surname */}
            <div className="space-y-2">
              <Label htmlFor="f-surname">Apellido</Label>
              <Input
                id="f-surname"
                placeholder="Apellido"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </div>

            {/* Dorsal */}
            <div className="space-y-2">
              <Label htmlFor="f-number">Dorsal</Label>
              <Input
                id="f-number"
                type="number"
                placeholder="Ej: 10"
                min={1}
                max={99}
                value={form.number ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    number: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>

            {/* Birth date */}
            <div className="space-y-2">
              <Label htmlFor="f-birth-date">Fecha de nacimiento</Label>
              <Input
                id="f-birth-date"
                type="date"
                value={form.birth_date ?? ""}
                onChange={(e) =>
                  setForm({ ...form, birth_date: e.target.value || undefined })
                }
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label>Posición</Label>
              <Select
                value={form.position ?? "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    position: v === "none" ? undefined : (v as PlayerPosition),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin posición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin posición</SelectItem>
                  <SelectItem value="goalkeeper">Portero</SelectItem>
                  <SelectItem value="defender">Defensa</SelectItem>
                  <SelectItem value="midfielder">Mediocampista</SelectItem>
                  <SelectItem value="forward">Delantero</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nationality */}
            <div className="space-y-2">
              <Label htmlFor="f-nationality">Nacionalidad</Label>
              <Input
                id="f-nationality"
                placeholder="Ej: Colombiano"
                value={form.nationality ?? ""}
                onChange={(e) =>
                  setForm({ ...form, nationality: e.target.value })
                }
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="f-phone">Teléfono</Label>
              <Input
                id="f-phone"
                placeholder="Ej: +57 300..."
                value={form.phone ?? ""}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="f-notes">Notas</Label>
              <Textarea
                id="f-notes"
                placeholder="Observaciones adicionales..."
                className="resize-none h-20"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingPlayer ? "Guardar cambios" : "Crear jugador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar jugador?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará a{" "}
              <strong>{deletingPlayer?.name}</strong> permanentemente y no se
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
