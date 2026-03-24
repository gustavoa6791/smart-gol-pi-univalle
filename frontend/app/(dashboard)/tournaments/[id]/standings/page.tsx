"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

export default function StandingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/tournaments/${id}/standings`)
      .then((res) => setStandings(res.data))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/tournaments/manage")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Tabla de posiciones</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Posiciones
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
              {standings.map((row, index) => (
                <TableRow
                  key={row.team_id}
                  className={index === 0 && row.points > 0 ? "bg-green-50" : ""}
                >
                  <TableCell className="text-center font-bold">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.team_name}</TableCell>
                  <TableCell className="text-center">{row.played}</TableCell>
                  <TableCell className="text-center">{row.won}</TableCell>
                  <TableCell className="text-center">{row.drawn}</TableCell>
                  <TableCell className="text-center">{row.lost}</TableCell>
                  <TableCell className="text-center">{row.goals_for}</TableCell>
                  <TableCell className="text-center">
                    {row.goals_against}
                  </TableCell>
                  <TableCell
                    className={`text-center font-medium ${
                      row.goal_difference > 0
                        ? "text-green-600"
                        : row.goal_difference < 0
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {row.goal_difference > 0 ? "+" : ""}
                    {row.goal_difference}
                  </TableCell>
                  <TableCell className="text-center font-bold text-lg">
                    {row.points}
                  </TableCell>
                </TableRow>
              ))}
              {standings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground py-6"
                  >
                    No hay equipos en el torneo
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
