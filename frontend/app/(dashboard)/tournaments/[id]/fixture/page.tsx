"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardEdit, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: number;
  round: number;
  home_team: { id: number; name: string };
  away_team: { id: number; name: string };
  home_score: number | null;
  away_score: number | null;
  status: "pending" | "played";
}

export default function FixturePage() {
  const { id } = useParams();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/tournaments/${id}/matches`)
      .then((res) => setMatches(res.data))
      .catch(() => toast.error("Error cargando fixture"))
      .finally(() => setLoading(false));
  }, [id]);

  const rounds = matches.reduce<Record<number, Match[]>>((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/tournaments/manage")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Fixture del torneo</h1>
      </div>

      {/* Jornadas */}
      {Object.keys(rounds).map((round) => (
        <Card key={round}>
          <CardHeader>
            <CardTitle>Jornada {round}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {rounds[Number(round)].map((match) => (
              <div
                key={match.id}
                className="flex items-center gap-3 border p-3 rounded-lg"
              >
                <span className="flex-1 text-right font-medium truncate">
                  {match.home_team.name}
                </span>

                <div className="flex items-center gap-2 min-w-[80px] justify-center">
                  {match.status === "played" ? (
                    <span className="text-lg font-bold">
                      {match.home_score} - {match.away_score}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">vs</span>
                  )}
                </div>

                <span className="flex-1 font-medium truncate">
                  {match.away_team.name}
                </span>

                <div className="flex items-center gap-2">
                  {match.status === "played" ? (
                    <Badge variant="secondary">Jugado</Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(`/tournaments/${id}/match/${match.id}`)
                    }
                  >
                    <ClipboardEdit className="h-4 w-4 mr-1" />
                    {match.status === "played" ? "Editar" : "Registrar"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
