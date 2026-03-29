"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";

interface BracketMatch {
  id: number;
  round: number;
  leg?: number | null;
  phase: string;
  bracket_position: number;
  next_match_id?: number | null;
  home_team?: { id: number; name: string } | null;
  away_team?: { id: number; name: string } | null;
  home_score?: number | null;
  away_score?: number | null;
  home_penalty?: number | null;
  away_penalty?: number | null;
  status: "pending" | "played";
}

interface Tie {
  phase: string;
  bracket_position: number;
  leg1?: BracketMatch;
  leg2?: BracketMatch;
  single?: BracketMatch;
  teamA?: { id: number; name: string } | null;
  teamB?: { id: number; name: string } | null;
}

const PHASE_LABELS: Record<string, string> = {
  round_of_16: "Octavos de Final",
  quarterfinal: "Cuartos de Final",
  semifinal: "Semifinales",
  final: "Final",
  third_place: "Tercer Puesto",
};

export default function BracketPage() {
  const { id } = useParams();
  const router = useRouter();
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/tournaments/${id}/bracket`)
      .then((res) => setMatches(res.data))
      .catch(() => toast.error("Error cargando bracket"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  // Agrupar en "ties" (llaves): mismos phase + bracket_position
  const tieMap: Record<string, Tie> = {};
  matches.forEach((m) => {
    const key = `${m.phase}_${m.bracket_position}`;
    if (!tieMap[key]) {
      tieMap[key] = { phase: m.phase, bracket_position: m.bracket_position };
    }
    const tie = tieMap[key];
    if (m.leg === 1) {
      tie.leg1 = m;
      tie.teamA = m.home_team;
      tie.teamB = m.away_team;
    } else if (m.leg === 2) {
      tie.leg2 = m;
      if (!tie.teamA) {
        tie.teamA = m.away_team;
        tie.teamB = m.home_team;
      }
    } else {
      tie.single = m;
      tie.teamA = m.home_team;
      tie.teamB = m.away_team;
    }
  });

  const ties = Object.values(tieMap);

  // Agrupar ties por fase
  const phaseOrder = ["round_of_16", "quarterfinal", "semifinal", "final", "third_place"];
  const byPhase: Record<string, Tie[]> = {};
  ties.forEach((t) => {
    if (!byPhase[t.phase]) byPhase[t.phase] = [];
    byPhase[t.phase].push(t);
  });
  for (const phase of Object.keys(byPhase)) {
    byPhase[phase].sort((a, b) => a.bracket_position - b.bracket_position);
  }

  const phases = phaseOrder.filter((p) => byPhase[p]);

  function computeGlobal(tie: Tie) {
    if (tie.single) {
      if (tie.single.status !== "played") return null;
      const hasPen = tie.single.home_penalty != null && tie.single.away_penalty != null;
      return {
        a: tie.single.home_score ?? 0,
        b: tie.single.away_score ?? 0,
        penA: hasPen ? tie.single.home_penalty! : null,
        penB: hasPen ? tie.single.away_penalty! : null,
        complete: true,
      };
    }
    const leg1Played = tie.leg1?.status === "played";
    const leg2Played = tie.leg2?.status === "played";
    if (!leg1Played && !leg2Played) return null;
    const a = (leg1Played ? (tie.leg1!.home_score ?? 0) : 0) + (leg2Played ? (tie.leg2!.away_score ?? 0) : 0);
    const b = (leg1Played ? (tie.leg1!.away_score ?? 0) : 0) + (leg2Played ? (tie.leg2!.home_score ?? 0) : 0);
    // Penales en leg2 (donde se definen si hay empate global)
    const hasPen = leg2Played && tie.leg2!.home_penalty != null && tie.leg2!.away_penalty != null;
    // En leg2: home=teamB, away=teamA
    const penA = hasPen ? tie.leg2!.away_penalty! : null;
    const penB = hasPen ? tie.leg2!.home_penalty! : null;
    return { a, b, penA, penB, complete: leg1Played && leg2Played };
  }

  function renderTie(tie: Tie) {
    const global = computeGlobal(tie);
    const aWinsByScore = global !== null && global.complete && global.a > global.b;
    const bWinsByScore = global !== null && global.complete && global.b > global.a;
    const aWinsByPen = global !== null && global.complete && global.a === global.b && global.penA !== null && global.penB !== null && global.penA > global.penB;
    const bWinsByPen = global !== null && global.complete && global.a === global.b && global.penA !== null && global.penB !== null && global.penB > global.penA;
    const aWins = aWinsByScore || aWinsByPen;
    const bWins = bWinsByScore || bWinsByPen;
    const hasPenalties = global !== null && global.penA !== null && global.penB !== null;
    const isHomeAway = !!tie.leg1;
    const allPlayed = isHomeAway
      ? tie.leg1?.status === "played" && tie.leg2?.status === "played"
      : tie.single?.status === "played";

    // Determine which match to navigate to
    const navMatch = tie.single || tie.leg1;
    const teamsReady = tie.teamA && tie.teamB;

    return (
      <div
        key={`${tie.phase}_${tie.bracket_position}`}
        className="border rounded-lg overflow-hidden bg-white shadow-sm transition-shadow"
      >
        {/* Equipo A */}
        <div className={`flex items-center justify-between px-3 py-2 ${aWins && global?.complete ? "bg-green-50" : ""}`}>
          <span className={`truncate font-medium ${!tie.teamA ? "text-muted-foreground italic" : ""} ${aWins && global?.complete ? "font-bold" : ""}`}>
            {tie.teamA?.name || "Por definir"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isHomeAway ? (
              <>
                <span className="text-xs text-muted-foreground w-5 text-center">
                  {tie.leg1?.status === "played" ? tie.leg1.home_score : "-"}
                </span>
                <span className="text-xs text-muted-foreground w-5 text-center">
                  {tie.leg2?.status === "played" ? tie.leg2.away_score : "-"}
                </span>
                {global !== null && (
                  <span className={`font-bold text-sm ml-1 w-5 text-center ${aWins && global.complete ? "text-green-700" : ""}`}>
                    {global.a}
                  </span>
                )}
              </>
            ) : (
              tie.single?.status === "played" && (
                <span className={`font-bold text-lg ${aWins ? "text-green-700" : ""}`}>
                  {tie.single.home_score}
                </span>
              )
            )}
          </div>
        </div>

        {/* Separador con labels si es ida/vuelta */}
        {isHomeAway && (tie.leg1?.status === "played" || tie.leg2?.status === "played") && (
          <div className="flex items-center justify-end px-3 py-0.5 bg-muted/30 border-y text-[10px] text-muted-foreground gap-2">
            <span className="w-5 text-center">Ida</span>
            <span className="w-5 text-center">Vta</span>
            <span className="w-5 text-center ml-1 font-semibold">Glo</span>
          </div>
        )}

        {/* Equipo B */}
        <div className={`flex items-center justify-between px-3 py-2 ${bWins && global?.complete ? "bg-green-50" : ""}`}>
          <span className={`truncate font-medium ${!tie.teamB ? "text-muted-foreground italic" : ""} ${bWins && global?.complete ? "font-bold" : ""}`}>
            {tie.teamB?.name || "Por definir"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isHomeAway ? (
              <>
                <span className="text-xs text-muted-foreground w-5 text-center">
                  {tie.leg1?.status === "played" ? tie.leg1.away_score : "-"}
                </span>
                <span className="text-xs text-muted-foreground w-5 text-center">
                  {tie.leg2?.status === "played" ? tie.leg2.home_score : "-"}
                </span>
                {global !== null && (
                  <span className={`font-bold text-sm ml-1 w-5 text-center ${bWins && global.complete ? "text-green-700" : ""}`}>
                    {global.b}
                  </span>
                )}
              </>
            ) : (
              tie.single?.status === "played" && (
                <span className={`font-bold text-lg ${bWins ? "text-green-700" : ""}`}>
                  {tie.single.away_score}
                </span>
              )
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="px-3 py-1 bg-muted/50 text-center border-t">
          {allPlayed && hasPenalties ? (
            <Badge variant="secondary" className="text-xs">
              Penales: {global!.penA} - {global!.penB}
            </Badge>
          ) : allPlayed ? (
            <Badge variant="secondary" className="text-xs">Jugado</Badge>
          ) : !teamsReady ? (
            <span className="text-xs text-muted-foreground">Esperando equipos</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/tournaments/manage")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-7 w-7" />
          Bracket
        </h1>
      </div>

      {ties.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay partidos de eliminatoria
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-6 pb-4 ${
          phases.length <= 3 ? `grid-cols-${phases.length}` :
          phases.length === 4 ? "grid-cols-4" : "grid-cols-5"
        }`} style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(220px, 1fr))` }}>
          {phases.map((phase) => (
            <div key={phase}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 text-center">
                {PHASE_LABELS[phase] || phase}
              </h3>
              <div className="space-y-4 flex flex-col justify-around h-full">
                {byPhase[phase].map(renderTie)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
