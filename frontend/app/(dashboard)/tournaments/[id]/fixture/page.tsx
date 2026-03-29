"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardEdit, ArrowLeft, Plus, Minus, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Match {
  id: number;
  round: number;
  leg?: number | null;
  phase?: string | null;
  group_name?: string | null;
  bracket_position?: number | null;
  home_team: { id: number; name: string } | null;
  away_team: { id: number; name: string } | null;
  home_score: number | null;
  away_score: number | null;
  home_penalty?: number | null;
  away_penalty?: number | null;
  status: "pending" | "played";
}

const PHASE_LABELS: Record<string, string> = {
  group: "Fase de Grupos",
  round_of_16: "Octavos de Final",
  quarterfinal: "Cuartos de Final",
  semifinal: "Semifinal",
  third_place: "Tercer Puesto",
  final: "Final",
};

const LEG_LABELS: Record<number, string> = {
  1: "Ida",
  2: "Vuelta",
};

export default function FixturePage() {
  const { id } = useParams();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Penalty state: keyed by match id
  const [penaltyState, setPenaltyState] = useState<Record<number, { home: number; away: number }>>({});
  const [savingPenalty, setSavingPenalty] = useState<number | null>(null);

  function loadMatches() {
    api
      .get(`/api/tournaments/${id}/matches`)
      .then((res) => setMatches(res.data))
      .catch(() => toast.error("Error cargando fixture"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMatches(); }, [id]);

  function getPenState(matchId: number) {
    return penaltyState[matchId] || { home: 0, away: 0 };
  }

  function setPen(matchId: number, side: "home" | "away", delta: number) {
    setPenaltyState((prev) => {
      const current = prev[matchId] || { home: 0, away: 0 };
      return { ...prev, [matchId]: { ...current, [side]: Math.max(0, current[side] + delta) } };
    });
  }

  async function savePenalties(matchId: number) {
    const pen = getPenState(matchId);
    if (pen.home === pen.away) {
      toast.error("Los penales deben tener un ganador");
      return;
    }
    setSavingPenalty(matchId);
    try {
      const m = matches.find((x) => x.id === matchId);
      if (!m) return;
      await api.patch(`/api/tournaments/matches/${matchId}/score`, {
        home_score: m.home_score ?? 0,
        away_score: m.away_score ?? 0,
        home_penalty: pen.home,
        away_penalty: pen.away,
      });
      toast.success("Penales registrados");
      loadMatches();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al guardar penales");
    } finally {
      setSavingPenalty(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  // Fila de penales editable para una llave
  function renderPenaltyRow(matchId: number, teamAName: string, teamBName: string, existingPenA?: number | null, existingPenB?: number | null) {
    const alreadySaved = existingPenA != null && existingPenB != null;
    const pen = getPenState(matchId);
    const isSaving = savingPenalty === matchId;

    if (alreadySaved) {
      // Ya guardados: solo mostrar
      return (
        <div className="flex items-center gap-3 border-2 border-amber-300 bg-amber-50 p-3 rounded-lg">
          <span className="flex-1 text-right font-medium truncate text-sm">{teamAName}</span>
          <div className="flex flex-col items-center min-w-[100px]">
            <span className="text-xs font-semibold text-amber-700 mb-0.5">PENALES</span>
            <span className="text-lg font-bold text-amber-800">{existingPenA} - {existingPenB}</span>
          </div>
          <span className="flex-1 font-medium truncate text-sm">{teamBName}</span>
          <Badge className="bg-amber-100 text-amber-800 shrink-0">Definido</Badge>
        </div>
      );
    }

    // Editable
    return (
      <div className="flex items-center gap-3 border-2 border-amber-300 bg-amber-50 p-3 rounded-lg">
        <span className="flex-1 text-right font-medium truncate text-sm">{teamAName}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPen(matchId, "home", -1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center font-bold">{pen.home}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPen(matchId, "home", 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <span className="text-xs font-semibold text-amber-700">PEN</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPen(matchId, "away", -1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center font-bold">{pen.away}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPen(matchId, "away", 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <span className="flex-1 font-medium truncate text-sm">{teamBName}</span>
        <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => savePenalties(matchId)} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar
        </Button>
      </div>
    );
  }

  function renderMatch(match: Match) {
    const hasPen = match.home_penalty != null && match.away_penalty != null;
    return (
      <div key={match.id} className="flex items-center gap-3 border p-3 rounded-lg">
        <span className="flex-1 text-right font-medium truncate">
          {match.home_team?.name || "Por definir"}
        </span>
        <div className="flex flex-col items-center min-w-[100px]">
          {match.status === "played" ? (
            <>
              <span className="text-lg font-bold">
                {match.home_score} - {match.away_score}
              </span>
              {hasPen && (
                <span className="text-xs text-amber-600 font-semibold">
                  Pen: {match.home_penalty} - {match.away_penalty}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">vs</span>
          )}
        </div>
        <span className="flex-1 font-medium truncate">
          {match.away_team?.name || "Por definir"}
        </span>
        <div className="flex items-center gap-2">
          {match.status === "played" ? (
            <Badge variant="secondary">Jugado</Badge>
          ) : (
            <Badge variant="outline">Pendiente</Badge>
          )}
          {match.home_team && match.away_team && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/tournaments/${id}/match/${match.id}`)}
            >
              <ClipboardEdit className="h-4 w-4 mr-1" />
              {match.status === "played" ? "Editar" : "Registrar"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Renderiza un grupo de partidos agrupados por ronda
  function renderByRound(matchList: Match[], roundLabel: (r: number) => string) {
    const byRound: Record<number, Match[]> = {};
    matchList.forEach((m) => {
      if (!byRound[m.round]) byRound[m.round] = [];
      byRound[m.round].push(m);
    });

    return Object.keys(byRound)
      .sort((a, b) => Number(a) - Number(b))
      .map((round) => (
        <div key={round} className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">{roundLabel(Number(round))}</p>
          {byRound[Number(round)].map(renderMatch)}
        </div>
      ));
  }

  // Separar por tipo
  const groupMatches = matches.filter((m) => m.phase === "group");
  const knockoutMatches = matches.filter((m) => m.phase && m.phase !== "group");
  const plainMatches = matches.filter((m) => !m.phase); // round-robin sin fase

  const hasGroups = groupMatches.length > 0;
  const hasKnockout = knockoutMatches.length > 0;
  const hasLegs = matches.some((m) => m.leg && m.leg > 0);

  // Para round-robin/plain con ida y vuelta
  function renderLegSection(matchList: Match[], roundLabel: (r: number) => string) {
    const legs = [...new Set(matchList.map((m) => m.leg).filter(Boolean))].sort() as number[];

    if (legs.length <= 1) {
      // Sin ida/vuelta, agrupar solo por ronda
      return renderByRound(matchList, roundLabel);
    }

    // Con ida/vuelta: seccionar por leg
    return legs.map((leg) => {
      const legMatches = matchList.filter((m) => m.leg === leg);
      // Numerar jornadas relativas dentro de cada leg
      const rounds = [...new Set(legMatches.map((m) => m.round))].sort((a, b) => a - b);
      const roundIndexMap = new Map<number, number>();
      rounds.forEach((r, i) => roundIndexMap.set(r, i + 1));

      return (
        <div key={leg} className="space-y-4">
          <h3 className="text-lg font-bold border-b pb-2">
            {LEG_LABELS[leg] || `Leg ${leg}`}
          </h3>
          {renderByRound(legMatches, (r) => `Jornada ${roundIndexMap.get(r) || r}`)}
        </div>
      );
    });
  }

  // Para grupos con ida y vuelta
  function renderGroupSection() {
    const groupNames = [...new Set(groupMatches.map((m) => m.group_name || "?"))].sort();

    return groupNames.map((groupName) => {
      const gMatches = groupMatches.filter((m) => m.group_name === groupName);

      return (
        <Card key={groupName}>
          <CardHeader>
            <CardTitle>Grupo {groupName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderLegSection(gMatches, (r) => `Jornada ${r}`)}
          </CardContent>
        </Card>
      );
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/tournaments/manage")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">Fixture del torneo</h1>
      </div>

      {/* Fase de Grupos */}
      {hasGroups && (
        <>
          <h2 className="text-xl font-bold">Fase de Grupos</h2>
          {renderGroupSection()}
        </>
      )}

      {/* Fase Eliminatoria */}
      {hasKnockout && (
        <>
          {hasGroups && <h2 className="text-xl font-bold">Fase Eliminatoria</h2>}
          {(() => {
            const byPhase: Record<string, Match[]> = {};
            knockoutMatches.forEach((m) => {
              const p = m.phase || "unknown";
              if (!byPhase[p]) byPhase[p] = [];
              byPhase[p].push(m);
            });
            const phaseOrder = ["round_of_16", "quarterfinal", "semifinal", "final", "third_place"];
            const hasLegsKO = knockoutMatches.some((m) => m.leg && m.leg > 0);

            return phaseOrder
              .filter((p) => byPhase[p])
              .map((phase) => {
                const phaseMatches = byPhase[phase];

                if (!hasLegsKO) {
                  // Single match por llave
                  return (
                    <Card key={phase}>
                      <CardHeader>
                        <CardTitle>{PHASE_LABELS[phase] || phase}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {phaseMatches.map((m) => (
                          <div key={m.id} className="space-y-2">
                            {renderMatch(m)}
                            {/* Penales si empato */}
                            {m.status === "played" && m.home_score === m.away_score && m.home_team && m.away_team && (
                              renderPenaltyRow(m.id, m.home_team.name, m.away_team.name, m.home_penalty, m.away_penalty)
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                }

                // Ida y vuelta: agrupar por llave (bracket_position)
                const ties: Record<number, Match[]> = {};
                phaseMatches.forEach((m) => {
                  const bp = m.bracket_position || 0;
                  if (!ties[bp]) ties[bp] = [];
                  ties[bp].push(m);
                });

                return (
                  <Card key={phase}>
                    <CardHeader>
                      <CardTitle>{PHASE_LABELS[phase] || phase}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {Object.keys(ties).sort((a, b) => Number(a) - Number(b)).map((bp) => {
                        const tieMatches = ties[Number(bp)].sort((a, b) => (a.leg || 0) - (b.leg || 0));
                        const leg1 = tieMatches.find((m) => m.leg === 1);
                        const leg2 = tieMatches.find((m) => m.leg === 2);
                        // Calcular global
                        const teamA = leg1?.home_team?.name || "Por definir";
                        const teamB = leg1?.away_team?.name || "Por definir";
                        let globalA: number | null = null;
                        let globalB: number | null = null;
                        if (leg1?.status === "played" && leg2?.status === "played") {
                          globalA = (leg1.home_score || 0) + (leg2.away_score || 0);
                          globalB = (leg1.away_score || 0) + (leg2.home_score || 0);
                        }
                        // Penales en leg2 (si hay empate global)
                        const hasPenTie = leg2?.home_penalty != null && leg2?.away_penalty != null;
                        // leg2 home=teamB, away=teamA
                        const penA = hasPenTie ? leg2!.away_penalty : null;
                        const penB = hasPenTie ? leg2!.home_penalty : null;

                        return (
                          <div key={bp} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="font-semibold text-sm">
                                Llave {bp}: {teamA} vs {teamB}
                              </p>
                              <div className="flex items-center gap-2">
                                {globalA !== null && globalB !== null && (
                                  <Badge variant="secondary" className="font-bold">
                                    Global: {globalA} - {globalB}
                                  </Badge>
                                )}
                                {hasPenTie && (
                                  <Badge className="bg-amber-100 text-amber-800 font-bold">
                                    Pen: {penA} - {penB}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {tieMatches.map((m) => (
                              <div key={m.id}>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  {m.leg === 1 ? "Ida" : m.leg === 2 ? "Vuelta" : ""}
                                </p>
                                {renderMatch(m)}
                              </div>
                            ))}
                            {/* Fila de penales si global empata */}
                            {globalA !== null && globalB !== null && globalA === globalB && leg2 && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-1">Penales</p>
                                {renderPenaltyRow(leg2.id, teamA, teamB, penA, penB)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              });
          })()}
        </>
      )}

      {/* Round-robin puro (sin fase) */}
      {plainMatches.length > 0 && !hasGroups && !hasKnockout && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            {renderLegSection(plainMatches, (r) => `Jornada ${r}`)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
