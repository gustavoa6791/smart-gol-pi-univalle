"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Trophy, Users, Target, CalendarDays, Loader2, ListChecks, ShieldCheck, Activity,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Volume2 } from "lucide-react";

interface PublicStats {
  total_players: number;
  total_teams: number;
  total_tournaments: number;
  total_goals: number;
}

interface PublicTournament {
  id: number;
  name: string;
  type: string | null;
  teams_count: number;
  teams_advance_per_group: number | null;
}

interface PublicMatch {
  id: number;
  round: number;
  phase: string | null;
  group_name: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

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

interface ScorerRow {
  player_id: number;
  player_name: string;
  team_name: string;
  goals: number;
}

const TYPE_LABELS: Record<string, string> = {
  round_robin: "Liga",
  knockout: "Eliminatoria",
  mixed: "Mixto",
};

export default function LandingPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [tournaments, setTournaments] = useState<PublicTournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [matches, setMatches] = useState<PublicMatch[]>([]);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [groupStandings, setGroupStandings] = useState<Record<string, StandingRow[]>>({});
  const [groups, setGroups] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selected = tournaments.find((t) => t.id === selectedId) || null;

  const handleSpeakMatches = async () => {
    if (!selected) return;

    const upcomingMatches = matches.filter(
      (m) => m.status !== "played"
    );

    if (upcomingMatches.length === 0) {
      alert("No hay partidos pendientes");
      return;
    }

    let text = `Próximos partidos de ${selected.name}. `;

    upcomingMatches.slice(0, 2).forEach((m, index) => {
      text += `Partido ${index + 1}. `;
      text += `${m.home_team} contra ${m.away_team}. `;
    });

    const response = await fetch(
      "http://localhost:8000/tts/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
        }),
      }
    );

    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);

    audio.play();
  };

  useEffect(() => {
    Promise.all([
      api.get<PublicStats>("/api/public/stats"),
      api.get<PublicTournament[]>("/api/public/tournaments"),
    ])
      .then(([s, t]) => {
        setStats(s.data);
        setTournaments(t.data);
        if (t.data.length > 0) setSelectedId(t.data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId == null || !selected) return;
    setLoadingDetail(true);
    setStandings([]);
    setGroupStandings({});
    setGroups([]);

    const isMixed = selected.type === "mixed";

    Promise.all([
      api.get<PublicMatch[]>(`/api/public/tournaments/${selectedId}/matches`),
      api.get<ScorerRow[]>(`/api/public/tournaments/${selectedId}/scorers`),
    ])
      .then(async ([m, sc]) => {
        setMatches(m.data);
        setScorers(sc.data);

        if (isMixed) {
          const groupNames = [...new Set(
            m.data
              .filter((mm) => mm.phase === "group" && mm.group_name)
              .map((mm) => mm.group_name as string)
          )].sort();
          setGroups(groupNames);
          const gs: Record<string, StandingRow[]> = {};
          await Promise.all(
            groupNames.map(async (g) => {
              const r = await api.get<StandingRow[]>(
                `/api/public/tournaments/${selectedId}/standings?group=${g}`
              );
              gs[g] = r.data;
            })
          );
          setGroupStandings(gs);
        } else if (selected.type === "round_robin") {
          const r = await api.get<StandingRow[]>(
            `/api/public/tournaments/${selectedId}/standings`
          );
          setStandings(r.data);
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId, selected]);

  const playedMatches = matches.filter((m) => m.status === "played");
  const showStandings =
    selected?.type === "round_robin" || selected?.type === "mixed";
  const showBracket =
    selected?.type === "knockout" || selected?.type === "mixed";
  const knockoutMatches = matches.filter(
    (m) => m.phase && m.phase !== "group"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50">
      <PublicHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Gestiona tus torneos de fútbol
          </h1>
          <p className="text-lg text-gray-700 max-w-xl">
            Smart Gol es la plataforma para organizar equipos, jugadores, torneos y partidos.
            Genera fixtures automáticos, registra resultados y consulta estadísticas.
          </p>
          <div className="flex justify-center md:justify-start gap-3 pt-2">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white font-bold shadow-lg hover:shadow-xl">
                Empezar gratis
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-green-500 text-green-700 hover:bg-green-50">
                Ya tengo cuenta
              </Button>
            </Link>
          </div>
        </div>
        <HeroCarousel />
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard icon={ListChecks} title="Inscripciones" text="Registra jugadores con documentos, equipos y plantillas." />
        <FeatureCard icon={CalendarDays} title="Torneos y fixtures" text="Liga, eliminatoria o mixto. Fixtures automáticos round-robin." />
        <FeatureCard icon={Activity} title="Estadísticas" text="Tabla de posiciones, goleadores y resultados de cada partido." />
      </section>

      {/* Stats numbers */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin h-8 w-8 text-green-600" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} value={stats.total_players} label="Jugadores" />
            <StatCard icon={ShieldCheck} value={stats.total_teams} label="Equipos" />
            <StatCard icon={Trophy} value={stats.total_tournaments} label="Torneos" />
            <StatCard icon={Target} value={stats.total_goals} label="Goles anotados" />
          </div>
        ) : null}
      </section>

      {/* Tournament aside + per-tournament info */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Torneos</h2>
        {tournaments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay torneos disponibles</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-3 items-stretch">
            {/* Aside: list of tournaments */}
            <Card className="shadow-md border-2 border-green-200 p-0 gap-0">
              <CardContent className="p-2 space-y-1 overflow-y-auto h-full">
                {tournaments.map((t) => {
                  const active = t.id === selectedId;

                  return (
                    <div key={t.id} className="space-y-1">
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium transition-all ${
                          active
                            ? "bg-gradient-to-r from-green-500 to-green-700 text-white shadow"
                            : "text-gray-700 hover:bg-green-50"
                        }`}
                      >
                        <div className="truncate">{t.name}</div>

                        {t.type && (
                          <div
                            className={`text-xs mt-0.5 ${
                              active ? "text-white/80" : "text-muted-foreground"
                            }`}
                          >
                            {TYPE_LABELS[t.type] || t.type}
                          </div>
                        )}
                      </button>

                      {active && (
                        <Button
                          size="sm"
                          onClick={handleSpeakMatches}
                          className="w-full flex items-center gap-2"
                        >
                          <Volume2 className="h-4 w-4" />
                          Escuchar próximos partidos
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Stacked cards */}
            <div className="space-y-2 min-w-0">
              {!selected ? null : loadingDetail ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin h-6 w-6 text-green-600" />
                </div>
              ) : (
                <>
                  {showStandings && (
                    <Card className="shadow-md border-2 border-green-200 p-0 gap-0 min-w-0">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-2 px-3">
                        <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                          <Trophy className="h-4 w-4 text-green-700" />
                          Posiciones
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-3 min-w-0">
                        {selected.type === "mixed" ? (
                          groups.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-1">
                              Aún sin resultados
                            </p>
                          ) : (
                            groups.map((g) => (
                              <StandingsTable
                                key={g}
                                title={`Grupo ${g}`}
                                rows={groupStandings[g] || []}
                                qualifyCount={selected.teams_advance_per_group || 0}
                              />
                            ))
                          )
                        ) : (
                          <StandingsTable rows={standings} />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {showBracket && (
                    <Card className="shadow-md border-2 border-green-200 p-0 gap-0 min-w-0">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-2 px-3">
                        <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                          <Trophy className="h-4 w-4 text-green-700" />
                          Eliminatorias
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3">
                        <SimpleBracket matches={knockoutMatches} />
                      </CardContent>
                    </Card>
                  )}

                  <Card className="shadow-md border-2 border-green-200 p-0 gap-0">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-2 px-3">
                      <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                        <CalendarDays className="h-4 w-4 text-green-700" />
                        Últimos partidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-1">
                      {playedMatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No hay partidos jugados
                        </p>
                      ) : (
                        playedMatches.slice(-5).reverse().map((m) => (
                          <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-1.5 rounded hover:bg-green-50 text-sm">
                            <span className="text-right truncate">{m.home_team}</span>
                            <span className="font-bold text-green-700 px-2 whitespace-nowrap">
                              {m.home_score ?? 0} - {m.away_score ?? 0}
                            </span>
                            <span className="truncate">{m.away_team}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-md border-2 border-green-200 p-0 gap-0">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 py-2 px-3">
                      <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
                        <Target className="h-4 w-4 text-green-700" />
                        Goleadores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-1">
                      {scorers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Aún no hay goles
                        </p>
                      ) : (
                        scorers.slice(0, 5).map((s, i) => (
                          <div key={s.player_id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-green-50 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-green-700 w-5">{i + 1}</span>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{s.player_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{s.team_name}</p>
                              </div>
                            </div>
                            <span className="font-bold text-base text-green-700">{s.goals}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-green-200 bg-white/80 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Smart Gol — Plataforma de gestión de fútbol
        </div>
      </footer>
    </div>
  );
}

function StandingsTable({
  rows,
  title,
  qualifyCount,
}: {
  rows: StandingRow[];
  title?: string;
  qualifyCount?: number;
}) {
  return (
    <div className="text-sm overflow-x-auto">
      {title && <h3 className="font-bold text-gray-900 mb-1 px-1">{title}</h3>}
      <table className="w-full">
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground">
            <th className="w-8 text-center py-1">#</th>
            <th className="text-left py-1">Equipo</th>
            <th className="text-center py-1">PJ</th>
            <th className="text-center py-1">PG</th>
            <th className="text-center py-1">PE</th>
            <th className="text-center py-1">PP</th>
            <th className="text-center py-1">DG</th>
            <th className="text-center py-1 font-bold">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center text-muted-foreground py-3">Sin datos</td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const qualifies = qualifyCount !== undefined && qualifyCount > 0 && i < qualifyCount;
              return (
                <tr key={row.team_id} className={`border-b last:border-0 ${qualifies ? "bg-green-50" : ""}`}>
                  <td className="text-center font-bold py-1">{i + 1}</td>
                  <td className="font-medium py-1 truncate">{row.team_name}</td>
                  <td className="text-center py-1">{row.played}</td>
                  <td className="text-center py-1">{row.won}</td>
                  <td className="text-center py-1">{row.drawn}</td>
                  <td className="text-center py-1">{row.lost}</td>
                  <td className={`text-center py-1 font-medium ${
                    row.goal_difference > 0 ? "text-green-600" : row.goal_difference < 0 ? "text-red-600" : ""
                  }`}>
                    {row.goal_difference > 0 ? "+" : ""}{row.goal_difference}
                  </td>
                  <td className="text-center py-1 font-bold">{row.points}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const PHASE_LABELS: Record<string, string> = {
  round_of_16: "Octavos",
  quarterfinal: "Cuartos",
  semifinal: "Semifinal",
  third_place: "Tercer puesto",
  final: "Final",
};

const PHASE_ORDER = ["round_of_16", "quarterfinal", "semifinal", "third_place", "final"];

function SimpleBracket({ matches }: { matches: PublicMatch[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-2">Sin eliminatorias generadas</p>;
  }

  // Group by phase, dedup by (phase + same teams) to combine legs
  const byPhase: Record<string, PublicMatch[]> = {};
  matches.forEach((m) => {
    if (!m.phase) return;
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m);
  });

  const orderedPhases = PHASE_ORDER.filter((p) => byPhase[p]?.length);

  return (
    <div className="space-y-3">
      {orderedPhases.map((phase) => (
        <div key={phase}>
          <h3 className="font-bold text-gray-900 text-sm mb-1">{PHASE_LABELS[phase]}</h3>
          <div className="space-y-1">
            {byPhase[phase].map((m) => {
              const played = m.status === "played";
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-1.5 rounded border border-green-100 hover:bg-green-50 text-sm"
                >
                  <span className="text-right truncate">{m.home_team || "—"}</span>
                  <span className={`font-bold px-2 whitespace-nowrap ${played ? "text-green-700" : "text-muted-foreground"}`}>
                    {played ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : "vs"}
                  </span>
                  <span className="truncate">{m.away_team || "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const HERO_IMAGES = [
  "/hero/imagen1.jpeg",
  "/hero/imagen2.jpeg",
  "/hero/imagen3.jpeg",
  "/hero/imagen4.jpeg",
  "/hero/imagen5.jpeg",
];

function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
      {HERO_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`Hero ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Ir a imagen ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-green-600" : "w-2 bg-white/80 hover:bg-green-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <Card className="shadow-md border-2 border-green-200 hover:shadow-xl transition-shadow">
      <CardContent className="pt-6 space-y-2">
        <Icon className="h-8 w-8 text-green-600" />
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <Card className="shadow-md border-2 border-green-200 text-center">
      <CardContent className="pt-6 pb-4 space-y-2">
        <Icon className="h-7 w-7 text-green-600 mx-auto" />
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
