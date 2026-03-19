"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: number;
  round: number;
  home_team: { name: string };
  away_team: { name: string };
}

export default function FixturePage() {
  const { id } = useParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/tournaments/${id}/matches`)
      .then((res) => setMatches(res.data))
      .catch(() => toast.error("Error cargando fixture"))
      .finally(() => setLoading(false));
  }, [id]);

  const rounds = matches.reduce((acc: any, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        Fixture del torneo
      </h1>

      {loading ? (
        <div className="flex justify-center">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        Object.keys(rounds).map((round) => (
          <Card key={round}>
            <CardHeader>
              <CardTitle>Jornada {round}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {rounds[round].map((match: Match) => (
                <div
                  key={match.id}
                  className="flex justify-between items-center border p-3 rounded-lg"
                >
                  <span>{match.home_team.name}</span>
                  <span>vs</span>
                  <span>{match.away_team.name}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}