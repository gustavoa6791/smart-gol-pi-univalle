"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Minus, ArrowLeft, Save } from "lucide-react";
// Note: Plus/Minus used for player stats, Save for save button
import { toast } from "sonner";

interface Player {
  id: number;
  first_name: string;
  second_name?: string | null;
  first_surname: string;
  second_surname?: string | null;
  position: string | null;
}

interface Team {
  id: number;
  name: string;
  players: Player[];
}

interface PlayerStat {
  player_id: number;
  team_id: number;
  goals: number;
  yellow_cards: number;
  red_cards: number;
}

interface MatchDetail {
  id: number;
  round: number;
  leg?: number | null;
  phase?: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalty: number | null;
  away_penalty: number | null;
  status: "pending" | "played";
  home_team: Team;
  away_team: Team;
  player_stats: Array<PlayerStat & { id: number; player: Player }>;
}

export default function MatchDetailPage() {
  const { id: tournamentId, matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<number, PlayerStat>>({});

  useEffect(() => {
    api
      .get(`/api/tournaments/matches/${matchId}/detail`)
      .then((res) => {
        const data: MatchDetail = res.data;
        setMatch(data);

        // Inicializar stats de todos los jugadores
        const initial: Record<number, PlayerStat> = {};

        // Jugadores del equipo local
        data.home_team.players.forEach((p) => {
          initial[p.id] = {
            player_id: p.id,
            team_id: data.home_team.id,
            goals: 0,
            yellow_cards: 0,
            red_cards: 0,
          };
        });

        // Jugadores del equipo visitante
        data.away_team.players.forEach((p) => {
          initial[p.id] = {
            player_id: p.id,
            team_id: data.away_team.id,
            goals: 0,
            yellow_cards: 0,
            red_cards: 0,
          };
        });

        // Cargar stats existentes si ya se jugó
        data.player_stats.forEach((s) => {
          initial[s.player_id] = {
            player_id: s.player_id,
            team_id: s.team_id,
            goals: s.goals,
            yellow_cards: s.yellow_cards,
            red_cards: s.red_cards,
          };
        });

        setStats(initial);
      })
      .catch(() => toast.error("Error cargando partido"))
      .finally(() => setLoading(false));
  }, [matchId]);

  const updateStat = (
    playerId: number,
    field: "goals" | "yellow_cards" | "red_cards",
    delta: number
  ) => {
    setStats((prev) => {
      const current = prev[playerId];
      if (!current) return prev;
      const newValue = Math.max(0, current[field] + delta);
      return { ...prev, [playerId]: { ...current, [field]: newValue } };
    });
  };

  const homeScore = match
    ? match.home_team.players.reduce((sum, p) => sum + (stats[p.id]?.goals || 0), 0)
    : 0;

  const awayScore = match
    ? match.away_team.players.reduce((sum, p) => sum + (stats[p.id]?.goals || 0), 0)
    : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const allStats = Object.values(stats).filter(
        (s) => s.goals > 0 || s.yellow_cards > 0 || s.red_cards > 0
      );
      await api.post(`/api/tournaments/matches/${matchId}/stats`, {
        stats: allStats,
      });
      toast.success("Resultado guardado correctamente");
      router.push(`/tournaments/${tournamentId}/fixture`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al guardar resultado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!match) return null;

  const renderPlayerRow = (player: Player) => {
    const stat = stats[player.id];
    if (!stat) return null;

    return (
      <div
        key={player.id}
        className="flex items-center justify-between py-2 px-3 border-b last:border-b-0"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium truncate">
            {player.first_name} {player.first_surname}
          </span>
          {player.position && (
            <Badge variant="outline" className="text-xs shrink-0">
              {player.position === "goalkeeper"
                ? "POR"
                : player.position === "defender"
                ? "DEF"
                : player.position === "midfielder"
                ? "MED"
                : "DEL"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Goles */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground w-8 text-center">
              Gol
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-red-600 hover:bg-red-50"
              onClick={() => updateStat(player.id, "goals", -1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center font-bold">{stat.goals}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-green-600 hover:bg-green-50"
              onClick={() => updateStat(player.id, "goals", 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Tarjetas amarillas */}
          <div className="flex items-center gap-1">
            <span className="w-4 h-5 bg-yellow-400 rounded-sm shrink-0" />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-red-600 hover:bg-red-50"
              onClick={() => updateStat(player.id, "yellow_cards", -1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center font-bold">
              {stat.yellow_cards}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-green-600 hover:bg-green-50"
              onClick={() => updateStat(player.id, "yellow_cards", 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Tarjetas rojas */}
          <div className="flex items-center gap-1">
            <span className="w-4 h-5 bg-red-600 rounded-sm shrink-0" />
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-red-600 hover:bg-red-50"
              onClick={() => updateStat(player.id, "red_cards", -1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center font-bold">{stat.red_cards}</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7 text-green-600 hover:bg-green-50"
              onClick={() => updateStat(player.id, "red_cards", 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/tournaments/${tournamentId}/fixture`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al fixture
        </Button>
        <h1 className="text-2xl font-bold">Jornada {match.round}</h1>
      </div>

      {/* Marcador */}
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-xl font-bold">{match.home_team.name}</p>
              <p className="text-xs text-muted-foreground">Local</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-black">
                {homeScore} - {awayScore}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Se calcula de los goles asignados
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{match.away_team.name}</p>
              <p className="text-xs text-muted-foreground">Visitante</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Penales se registran desde el fixture, no aqui */}

      {/* Equipo Local */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full" />
            {match.home_team.name}
            <Badge variant="secondary">{match.home_team.players.length} jugadores</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {match.home_team.players.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay jugadores asignados a este equipo
            </p>
          ) : (
            match.home_team.players.map(renderPlayerRow)
          )}
        </CardContent>
      </Card>

      {/* Equipo Visitante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full" />
            {match.away_team.name}
            <Badge variant="secondary">{match.away_team.players.length} jugadores</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {match.away_team.players.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay jugadores asignados a este equipo
            </p>
          ) : (
            match.away_team.players.map(renderPlayerRow)
          )}
        </CardContent>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          Guardar resultado
        </Button>
      </div>
    </div>
  );
}
