"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Team, Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Upload,
  Shield,
  X,
  Plus,
  UserRound,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero",
  defender: "Defensa",
  midfielder: "Mediocampista",
  forward: "Delantero",
};

export default function TeamDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const shieldInputRef = useRef<HTMLInputElement>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingShield, setUploadingShield] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [playerIds, setPlayerIds] = useState<number[]>([]);
  const [leaderId, setLeaderId] = useState<number | null>(null);

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Team>(`/api/teams/${id}`),
      api.get<Player[]>("/api/players/"),
      api.get<Team[]>("/api/teams/"),
    ])
      .then(([teamRes, playersRes, teamsRes]) => {
        const t = teamRes.data;
        setTeam(t);
        setName(t.name);
        setCoachName(t.coach_name);
        setPlayerIds(t.players?.map((p) => p.id) || []);
        setLeaderId(t.leader_id ?? null);
        setAllPlayers(playersRes.data);
        setAllTeams(teamsRes.data);
      })
      .catch(() => toast.error("Error al cargar equipo"))
      .finally(() => setLoading(false));
  }, [id]);

  // IDs de jugadores que ya pertenecen a OTRO equipo (no al actual)
  const takenPlayerIds = new Set<number>();
  for (const t of allTeams) {
    if (t.id === Number(id)) continue;
    t.players?.forEach((p) => takenPlayerIds.add(p.id));
  }

  const teamPlayers: Player[] = allPlayers.filter((p) =>
    playerIds.includes(p.id)
  );

  // Jugadores disponibles: no estan en este equipo NI en otro
  const availablePlayers = allPlayers.filter(
    (p) => !playerIds.includes(p.id) && !takenPlayerIds.has(p.id)
  );

  function openSearchModal() {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSearchOpen(true);
  }

  function handleSearch() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults(availablePlayers);
      setHasSearched(true);
      return;
    }
    const results = availablePlayers.filter((p) => {
      const fullName = [p.first_name, p.second_name, p.first_surname, p.second_surname]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const doc = (p.document_number || "").toLowerCase();
      return fullName.includes(q) || doc.includes(q);
    });
    setSearchResults(results);
    setHasSearched(true);
  }

  function addPlayerFromModal(pid: number) {
    if (!playerIds.includes(pid)) {
      setPlayerIds((prev) => [...prev, pid]);
    }
    // Remove from search results
    setSearchResults((prev) => prev.filter((p) => p.id !== pid));
    toast.success("Jugador agregado a la plantilla");
  }

  function removePlayer(pid: number) {
    setPlayerIds((prev) => prev.filter((id) => id !== pid));
    if (leaderId === pid) setLeaderId(null);
  }

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!coachName.trim()) {
      toast.error("El formador es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/api/teams/${id}`, {
        name: name.trim(),
        coach_name: coachName.trim(),
        player_ids: playerIds,
        leader_id:
          leaderId && playerIds.includes(leaderId) ? leaderId : null,
      });
      setTeam(data);
      // Refrescar equipos para actualizar jugadores tomados
      api.get<Team[]>("/api/teams/").then((r) => setAllTeams(r.data));
      toast.success("Cambios guardados");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Error al guardar cambios";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Estas seguro de eliminar este equipo? Esta accion no se puede deshacer."))
      return;
    setDeleting(true);
    try {
      await api.delete(`/api/teams/${id}`);
      toast.success("Equipo eliminado");
      router.push("/teams");
    } catch {
      toast.error("Error al eliminar equipo");
    } finally {
      setDeleting(false);
    }
  }

  async function handleShieldUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingShield(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/api/teams/${id}/shield`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTeam(data);
      toast.success("Escudo actualizado");
    } catch {
      toast.error("Error al subir escudo");
    } finally {
      setUploadingShield(false);
      if (shieldInputRef.current) shieldInputRef.current.value = "";
    }
  }

  async function handleDeleteShield() {
    if (!confirm("¿Eliminar el escudo del equipo?")) return;
    try {
      const { data } = await api.delete(`/api/teams/${id}/shield`);
      setTeam(data);
      toast.success("Escudo eliminado");
    } catch {
      toast.error("Error al eliminar escudo");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!team) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/teams")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <h1 className="text-2xl font-bold truncate">{team.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            form="team-form"
            disabled={saving}
            size="sm"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar cambios
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Escudo */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Escudo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="w-48 h-48 rounded-xl overflow-hidden bg-muted flex items-center justify-center border-2 border-muted">
              {team.shield_url ? (
                <img
                  src={`${BACKEND}${team.shield_url}`}
                  alt={team.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Shield className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <input
              ref={shieldInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleShieldUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => shieldInputRef.current?.click()}
              disabled={uploadingShield}
            >
              {uploadingShield ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {team.shield_url ? "Cambiar" : "Subir escudo"}
            </Button>
            {team.shield_url && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-destructive"
                onClick={handleDeleteShield}
              >
                <X className="h-4 w-4 mr-1" />
                Eliminar escudo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Formulario info basica */}
        <form
          id="team-form"
          onSubmit={handleSave}
          className="col-span-2 space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>Datos del equipo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre del equipo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Formador *</Label>
                <Input
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </div>

      {/* Jugadores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Plantilla de jugadores</CardTitle>
          <Button size="sm" variant="outline" onClick={openSearchModal}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar jugador
          </Button>
        </CardHeader>
        <CardContent>
          {teamPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay jugadores asignados. Haz clic en &quot;Agregar jugador&quot;
              para buscar y agregar jugadores al equipo.
            </p>
          ) : (
            <div className="space-y-2">
              {teamPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    {leaderId === player.id && (
                      <Badge className="bg-amber-100 text-amber-800 gap-1">
                        <UserRound className="h-3 w-3" />
                        Lider
                      </Badge>
                    )}
                    <span className="font-medium">
                      {player.first_name} {player.first_surname}
                    </span>
                    {player.position && (
                      <Badge variant="secondary" className="text-xs">
                        {POSITION_LABELS[player.position]}
                      </Badge>
                    )}
                    {player.document_type && player.document_number && (
                      <span className="text-xs text-muted-foreground">
                        {player.document_type} {player.document_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {leaderId !== player.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => setLeaderId(player.id)}
                      >
                        <UserRound className="h-3.5 w-3.5 mr-1" />
                        Hacer lider
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => setLeaderId(null)}
                      >
                        Quitar lider
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive shrink-0"
                      onClick={() => removePlayer(player.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {teamPlayers.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {teamPlayers.length} jugador{teamPlayers.length !== 1 ? "es" : ""}{" "}
              en la plantilla. Recuerda guardar los cambios.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal buscar jugador */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Buscar jugador</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nombre o documento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              autoFocus
            />
            <Button variant="outline" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              Buscar
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 mt-2">
            {!hasSearched ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Escribe un nombre o numero de documento y presiona buscar.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se encontraron jugadores disponibles.
              </p>
            ) : (
              <div className="space-y-1">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">
                        {[p.first_name, p.second_name, p.first_surname, p.second_surname]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                      <div className="flex items-center gap-2">
                        {p.position && (
                          <Badge variant="secondary" className="text-xs">
                            {POSITION_LABELS[p.position]}
                          </Badge>
                        )}
                        {p.document_type && p.document_number && (
                          <span className="text-xs text-muted-foreground">
                            {p.document_type} {p.document_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addPlayerFromModal(p.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
