"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, Target } from "lucide-react";
import { toast } from "sonner";

interface ScorerRow {
  player_id: number;
  player_name: string;
  team_id: number;
  team_name: string;
  goals: number;
  matches_played: number;
}

export default function ScorersPage() {
  const { id } = useParams();
  const router = useRouter();
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ScorerRow[]>(`/api/tournaments/${id}/scorers`)
      .then((res) => setScorers(res.data))
      .catch(() => toast.error("Error cargando goleadores"))
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
        <Button variant="outline" size="sm" onClick={() => router.push("/tournaments/manage")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Tabla de goleadores</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goleadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center font-bold">Goles</TableHead>
                <TableHead className="text-center">Prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorers.map((row, index) => (
                <TableRow key={row.player_id} className={index === 0 ? "bg-green-50" : ""}>
                  <TableCell className="text-center font-bold">{index + 1}</TableCell>
                  <TableCell className="font-medium">{row.player_name}</TableCell>
                  <TableCell>{row.team_name}</TableCell>
                  <TableCell className="text-center">{row.matches_played}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{row.goals}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {row.matches_played > 0
                      ? (row.goals / row.matches_played).toFixed(2)
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {scorers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aún no hay goles registrados
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
