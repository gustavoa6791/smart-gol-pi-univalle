"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Tournament } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";

interface StandingRow {
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

interface Match {
  id: number;
  phase?: string | null;
  group_name?: string | null;
}

export default function StandingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [groupStandings, setGroupStandings] = useState<Record<string, StandingRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Tournament>(`/api/tournaments/${id}`),
      api.get<Match[]>(`/api/tournaments/${id}/matches`),
    ]).then(async ([tRes, mRes]) => {
      const t = tRes.data;
      setTournament(t);

      const isMixed = t.template?.type === "mixed";

      if (isMixed) {
        // Encontrar grupos
        const groupNames = [...new Set(
          mRes.data
            .filter((m: Match) => m.phase === "group" && m.group_name)
            .map((m: Match) => m.group_name as string)
        )].sort();
        setGroups(groupNames);

        // Cargar standings por grupo
        const gs: Record<string, StandingRow[]> = {};
        await Promise.all(
          groupNames.map(async (g) => {
            const res = await api.get(`/api/tournaments/${id}/standings?group=${g}`);
            gs[g] = res.data;
          })
        );
        setGroupStandings(gs);
      } else {
        const res = await api.get(`/api/tournaments/${id}/standings`);
        setStandings(res.data);
      }
    })
      .catch(() => toast.error("Error cargando posiciones"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  const teamsAdvance = tournament?.template?.teams_advance_per_group ?? 0;

  function renderTable(rows: StandingRow[], title?: string, qualifyCount?: number) {
    return (
      <Card key={title}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {title || "Posiciones"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center">PG</TableHead>
                <TableHead className="text-center">PE</TableHead>
                <TableHead className="text-center">PP</TableHead>
                <TableHead className="text-center">GF</TableHead>
                <TableHead className="text-center">GC</TableHead>
                <TableHead className="text-center">DG</TableHead>
                <TableHead className="text-center font-bold">PTS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const qualifies = qualifyCount !== undefined && qualifyCount > 0 && index < qualifyCount;
                return (
                <TableRow key={row.team_id} className={qualifies ? "bg-green-50" : ""}>
                  <TableCell className="text-center font-bold">{index + 1}</TableCell>
                  <TableCell className="font-medium">{row.team_name}</TableCell>
                  <TableCell className="text-center">{row.played}</TableCell>
                  <TableCell className="text-center">{row.won}</TableCell>
                  <TableCell className="text-center">{row.drawn}</TableCell>
                  <TableCell className="text-center">{row.lost}</TableCell>
                  <TableCell className="text-center">{row.goals_for}</TableCell>
                  <TableCell className="text-center">{row.goals_against}</TableCell>
                  <TableCell className={`text-center font-medium ${
                    row.goal_difference > 0 ? "text-green-600" : row.goal_difference < 0 ? "text-red-600" : ""
                  }`}>
                    {row.goal_difference > 0 ? "+" : ""}{row.goal_difference}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg">{row.points}</TableCell>
                </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                    No hay datos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  const isMixed = tournament?.template?.type === "mixed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/tournaments/manage")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Tabla de posiciones</h1>
      </div>

      {isMixed ? (
        groups.map((g) => renderTable(groupStandings[g] || [], `Grupo ${g}`, teamsAdvance))
      ) : (
        renderTable(standings)
      )}
    </div>
  );
}
