"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useCurrentUser, canWrite } from "@/lib/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Minus, ArrowLeft, Save, Hash, Mic, Square, Printer, ScanLine } from "lucide-react";
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
  jersey_number?: number | null;
  low_confidence?: { goals?: boolean; yellow_cards?: boolean; red_cards?: boolean };
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

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function parseVoiceCommand(
  text: string,
  homeTeam: Team,
  awayTeam: Team,
  jerseyNums: Record<number, string>
): { playerId: number; field: "goals" | "yellow_cards" | "red_cards"; teamName: string; playerName: string } | null {
  const norm = normalize(text);

  let field: "goals" | "yellow_cards" | "red_cards" | null = null;
  if (norm.includes("gol")) field = "goals";
  else if (norm.includes("amarilla") || norm.includes("amarillo")) field = "yellow_cards";
  else if (norm.includes("roja") || norm.includes("rojo")) field = "red_cards";
  if (!field) return null;

  const allPlayers = [
    ...homeTeam.players.map((p) => ({ ...p, teamId: homeTeam.id, teamName: homeTeam.name })),
    ...awayTeam.players.map((p) => ({ ...p, teamId: awayTeam.id, teamName: awayTeam.name })),
  ];

  // Detect team from speech
  const scoreTeam = (teamName: string) => {
    const words = normalize(teamName).split(/\s+/).filter((w) => w.length > 2);
    return words.filter((w) => norm.includes(w)).length / Math.max(words.length, 1);
  };
  const homeScore = scoreTeam(homeTeam.name);
  const awayScore = scoreTeam(awayTeam.name);
  let teamFilter: number | null = null;
  if (homeScore > awayScore && homeScore > 0) teamFilter = homeTeam.id;
  else if (awayScore > homeScore && awayScore > 0) teamFilter = awayTeam.id;

  const candidates = teamFilter ? allPlayers.filter((p) => p.teamId === teamFilter) : allPlayers;

  // Try jersey number match: "numero 20", "número 20"
  const jerseyMatch = norm.match(/n[uú]mero\s+(\d+)|#\s*(\d+)/);
  if (jerseyMatch) {
    const num = jerseyMatch[1] ?? jerseyMatch[2];
    const byJersey = candidates.filter((p) => jerseyNums[p.id] === num);
    if (byJersey.length === 1) {
      return {
        playerId: byJersey[0].id,
        field,
        teamName: byJersey[0].teamName,
        playerName: `${byJersey[0].first_name} ${byJersey[0].first_surname}`,
      };
    }
    // Número encontrado pero ambiguo (mismo número en ambos equipos y no se mencionó equipo)
    if (byJersey.length > 1) return null;
  }

  // Fallback: name matching
  let bestPlayer = null;
  let bestScore = 0;
  for (const p of candidates) {
    const names = [p.first_name, p.first_surname, p.second_name, p.second_surname]
      .filter(Boolean)
      .map((n) => normalize(n!));
    const matches = names.filter((n) => n.length > 1 && norm.includes(n)).length;
    const score = matches / Math.max(names.length, 1);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestPlayer = p;
    }
  }

  if (!bestPlayer) return null;
  return {
    playerId: bestPlayer.id,
    field,
    teamName: bestPlayer.teamName,
    playerName: `${bestPlayer.first_name} ${bestPlayer.first_surname}`,
  };
}

export default function MatchDetailPage() {
  const { id: tournamentId, matchId } = useParams();
  const router = useRouter();
  const { user } = useCurrentUser();
  const writeAllowed = canWrite(user?.role);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<number, PlayerStat>>({});

  // Jersey numbers
  const [jerseyNums, setJerseyNums] = useState<Record<number, string>>({});
  const [editingJerseys, setEditingJerseys] = useState(false);

  // Auto-save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice STT
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const recognizerRef = useRef<{ stopContinuousRecognitionAsync: (cb: () => void, err: (e: unknown) => void) => void; close: () => void } | null>(null);

  // Escaneo de tarjeta de árbitro (OCR)
  const [scanningCard, setScanningCard] = useState(false);
  const [scorecardText, setScorecardText] = useState("");
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  const [autofilledPlayers, setAutofilledPlayers] = useState<Set<number>>(new Set());
  const [lowConfidenceFields, setLowConfidenceFields] = useState<
    Record<number, { goals?: boolean; yellow_cards?: boolean; red_cards?: boolean }>
  >({});
  const scorecardInputRef = useRef<HTMLInputElement | null>(null);
  const scorecardCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api
      .get(`/api/tournaments/matches/${matchId}/detail`)
      .then((res) => {
        const data: MatchDetail = res.data;
        setMatch(data);
        const initial: Record<number, PlayerStat> = {};
        data.home_team.players.forEach((p) => {
          initial[p.id] = { player_id: p.id, team_id: data.home_team.id, goals: 0, yellow_cards: 0, red_cards: 0 };
        });
        data.away_team.players.forEach((p) => {
          initial[p.id] = { player_id: p.id, team_id: data.away_team.id, goals: 0, yellow_cards: 0, red_cards: 0 };
        });
        const jerseys: Record<number, string> = {};
        data.player_stats.forEach((s) => {
          initial[s.player_id] = { player_id: s.player_id, team_id: s.team_id, goals: s.goals, yellow_cards: s.yellow_cards, red_cards: s.red_cards };
          if (s.jersey_number != null) jerseys[s.player_id] = String(s.jersey_number);
        });
        setStats(initial);
        setJerseyNums(jerseys);
      })
      .catch(() => toast.error("Error cargando partido"))
      .finally(() => setLoading(false));
  }, [matchId]);

  const autoSaveStats = (updatedStats: Record<number, PlayerStat>, currentJerseys: Record<number, string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const allStats = Object.values(updatedStats)
          .filter((s) => s.goals > 0 || s.yellow_cards > 0 || s.red_cards > 0 || currentJerseys[s.player_id])
          .map((s) => ({
            ...s,
            jersey_number: currentJerseys[s.player_id] ? Number(currentJerseys[s.player_id]) : null,
          }));
        await api.post(`/api/tournaments/matches/${matchId}/stats`, { stats: allStats });
      } catch {
        toast.error("Error al guardar automáticamente");
      }
    }, 800);
  };

  const updateStat = (playerId: number, field: "goals" | "yellow_cards" | "red_cards", delta: number) => {
    setStats((prev) => {
      const current = prev[playerId];
      if (!current) return prev;
      const next = { ...prev, [playerId]: { ...current, [field]: Math.max(0, current[field] + delta) } };
      autoSaveStats(next, jerseyNums);
      return next;
    });
  };

  const saveJerseys = async () => {
    setEditingJerseys(false);
    try {
      const allStats = Object.values(stats)
        .filter((s) => s.goals > 0 || s.yellow_cards > 0 || s.red_cards > 0 || jerseyNums[s.player_id])
        .map((s) => ({
          ...s,
          jersey_number: jerseyNums[s.player_id] ? Number(jerseyNums[s.player_id]) : null,
        }));
      await api.post(`/api/tournaments/matches/${matchId}/stats`, { stats: allStats });
      toast.success("Números guardados");
    } catch {
      toast.error("Error al guardar números");
    }
  };

  function openScorecardScan() {
    if (Object.keys(jerseyNums).length === 0) {
      toast.error("Asigna los números de camiseta primero (\"Editar números\"). Sin eso no se puede escanear la tarjeta.");
      return;
    }
    scorecardCameraInputRef.current?.click();
  }

  // Azure Vision Read tiene un límite duro de 4MB por imagen (no configurable).
  // Las fotos de celular suelen pesar más, así que las re-comprimimos en el navegador antes de subir.
  async function compressImageForOcr(file: File): Promise<Blob> {
    const MAX_DIMENSION = 2600;
    const MAX_BYTES = 3.5 * 1024 * 1024;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas no disponible");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.9;
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob && blob.size > MAX_BYTES && quality > 0.3) {
      quality -= 0.1;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (!blob) throw new Error("no se pudo comprimir la imagen");
    return blob;
  }

  async function handleScorecardUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanningCard(true);
    setScorecardText("");
    setUnmatchedLines([]);
    const formData = new FormData();

    try {
      const compressed = await compressImageForOcr(file);
      formData.append("file", compressed, "tarjeta.jpg");
    } catch {
      formData.append("file", file);
    }

    try {
      const { data } = await api.post(`/api/tournaments/matches/${matchId}/scorecard/extract`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.raw_text) setScorecardText(data.raw_text);
      if (data.message) toast.warning(data.message);

      const proposedStats: PlayerStat[] = data.stats ?? [];
      if (proposedStats.length > 0) {
        setStats((prev) => {
          const next = { ...prev };
          proposedStats.forEach((s) => {
            next[s.player_id] = { ...next[s.player_id], ...s };
          });
          autoSaveStats(next, jerseyNums);
          return next;
        });
        setAutofilledPlayers(new Set(proposedStats.map((s) => s.player_id)));

        const lowConf: Record<number, { goals?: boolean; yellow_cards?: boolean; red_cards?: boolean }> = {};
        let lowConfCount = 0;
        proposedStats.forEach((s) => {
          if (s.low_confidence) {
            lowConf[s.player_id] = s.low_confidence;
            if (s.low_confidence.goals || s.low_confidence.yellow_cards || s.low_confidence.red_cards) {
              lowConfCount += 1;
            }
          }
        });
        setLowConfidenceFields(lowConf);

        toast.success(`Se autocompletaron ${proposedStats.length} jugador(es) desde la tarjeta. Revisa antes de guardar.`);
        if (lowConfCount > 0) {
          toast.warning(`${lowConfCount} valor(es) con baja confianza de OCR (resaltados en rojo) — revísalos con cuidado.`);
        }
      }

      const lines: string[] = data.unmatched_lines ?? [];
      setUnmatchedLines(lines);
      if (lines.length > 0) {
        toast.warning(`${lines.length} línea(s) no se pudieron reconocer. Revísalas manualmente.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al leer la tarjeta");
    } finally {
      setScanningCard(false);
      if (scorecardInputRef.current) scorecardInputRef.current.value = "";
      if (scorecardCameraInputRef.current) scorecardCameraInputRef.current.value = "";
    }
  }

  const homeScore = match ? match.home_team.players.reduce((sum, p) => sum + (stats[p.id]?.goals || 0), 0) : 0;
  const awayScore = match ? match.away_team.players.reduce((sum, p) => sum + (stats[p.id]?.goals || 0), 0) : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const allStats = Object.values(stats)
        .filter((s) => s.goals > 0 || s.yellow_cards > 0 || s.red_cards > 0 || jerseyNums[s.player_id])
        .map((s) => ({
          ...s,
          jersey_number: jerseyNums[s.player_id] ? Number(jerseyNums[s.player_id]) : null,
        }));
      await api.post(`/api/tournaments/matches/${matchId}/stats`, { stats: allStats });
      toast.success("Resultado guardado correctamente");
      router.push(`/tournaments/${tournamentId}/fixture`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error al guardar resultado");
    } finally {
      setSaving(false);
    }
  };

  async function startVoice() {
    try {
      const { data } = await api.get("/api/speech/token");
      const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(data.token, data.region);
      speechConfig.speechRecognitionLanguage = "es-CO";
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      setVoiceText("");
      setListening(true);

      recognizer.recognizing = (_s: unknown, e: { result: { text: string } }) => {
        setVoiceText(e.result.text);
      };

      recognizer.recognizeOnceAsync(
        (result: { reason: number; text: string }) => {
          setListening(false);
          recognizer.close();
          recognizerRef.current = null;

          if (!result.text?.trim()) {
            setVoiceText("");
            toast("No se captó audio. Intenta de nuevo.");
            return;
          }

          setVoiceText(result.text);

          if (!match) return;
          const parsed = parseVoiceCommand(result.text, match.home_team, match.away_team, jerseyNums);

          if (!parsed) {
            toast.error(`No se reconoció el evento. Escuché: "${result.text}"`);
            return;
          }

          updateStat(parsed.playerId, parsed.field, 1);

          const eventLabel = parsed.field === "goals" ? "⚽ Gol" : parsed.field === "yellow_cards" ? "🟨 Amarilla" : "🟥 Roja";
          toast.success(`${eventLabel} — ${parsed.playerName} (${parsed.teamName})`);
          setVoiceText("");
        },
        (err: unknown) => {
          setListening(false);
          recognizer.close();
          recognizerRef.current = null;
          setVoiceText("");
          toast.error("Error en reconocimiento de voz");
          console.error(err);
        }
      );

      recognizerRef.current = recognizer as unknown as typeof recognizerRef.current;
    } catch {
      setListening(false);
      toast.error("No se pudo iniciar el dictado (¿permiso de micrófono?)");
    }
  }

  function stopVoice() {
    const recognizer = recognizerRef.current;
    setListening(false);
    setVoiceText("");
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(() => recognizer.close(), () => recognizer.close());
      recognizerRef.current = null;
    }
  }

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

    const autofilled = autofilledPlayers.has(player.id);
    const lowConf = lowConfidenceFields[player.id];

    return (
      <div
        key={player.id}
        className={`flex items-center justify-between py-2 px-3 border-b last:border-b-0 ${
          autofilled ? "ring-2 ring-green-400 bg-green-50/60" : ""
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editingJerseys ? (
            <Input
              type="number"
              min={1}
              max={99}
              placeholder="#"
              value={jerseyNums[player.id] ?? ""}
              onChange={(e) => setJerseyNums((prev) => ({ ...prev, [player.id]: e.target.value }))}
              className="w-14 h-7 text-center text-sm px-1"
            />
          ) : jerseyNums[player.id] ? (
            <span className="w-7 h-7 flex items-center justify-center bg-muted rounded text-xs font-bold shrink-0">
              {jerseyNums[player.id]}
            </span>
          ) : null}

          <span className="font-medium truncate">
            {player.first_name} {player.first_surname}
          </span>
          {player.position && (
            <Badge variant="outline" className="text-xs shrink-0">
              {player.position === "goalkeeper" ? "POR" : player.position === "defender" ? "DEF" : player.position === "midfielder" ? "MED" : "DEL"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Goles */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground w-8 text-center">Gol</span>
            <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => updateStat(player.id, "goals", -1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span
              className={`w-6 text-center font-bold ${lowConf?.goals ? "ring-2 ring-red-500 rounded bg-red-50" : ""}`}
              title={lowConf?.goals ? "OCR con baja confianza — revisa este valor" : undefined}
            >
              {stat.goals}
            </span>
            <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => updateStat(player.id, "goals", 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Tarjetas amarillas */}
          <div className="flex items-center gap-1">
            <span className="w-4 h-5 bg-yellow-400 rounded-sm shrink-0" />
            <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => updateStat(player.id, "yellow_cards", -1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span
              className={`w-6 text-center font-bold ${lowConf?.yellow_cards ? "ring-2 ring-red-500 rounded bg-red-50" : ""}`}
              title={lowConf?.yellow_cards ? "OCR con baja confianza — revisa este valor" : undefined}
            >
              {stat.yellow_cards}
            </span>
            <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => updateStat(player.id, "yellow_cards", 1)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Tarjetas rojas */}
          <div className="flex items-center gap-1">
            <span className="w-4 h-5 bg-red-600 rounded-sm shrink-0" />
            <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => updateStat(player.id, "red_cards", -1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span
              className={`w-6 text-center font-bold ${lowConf?.red_cards ? "ring-2 ring-red-500 rounded bg-red-50" : ""}`}
              title={lowConf?.red_cards ? "OCR con baja confianza — revisa este valor" : undefined}
            >
              {stat.red_cards}
            </span>
            <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:bg-green-50" onClick={() => updateStat(player.id, "red_cards", 1)}>
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
        <Button variant="outline" size="sm" onClick={() => router.push(`/tournaments/${tournamentId}/fixture`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al fixture
        </Button>
        <h1 className="text-2xl font-bold">Jornada {match.round}</h1>

        {writeAllowed && (
          <div className="ml-auto flex gap-2">
            {editingJerseys ? (
              <Button size="sm" onClick={saveJerseys}>
                <Save className="h-4 w-4 mr-1" />
                Guardar números
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingJerseys(true)}>
                <Hash className="h-4 w-4 mr-1" />
                Editar números
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/tournaments/${tournamentId}/match/${matchId}/scorecard`)}
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimir tarjeta
            </Button>

            <input
              ref={scorecardInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
              className="hidden"
              onChange={handleScorecardUpload}
            />
            <input
              ref={scorecardCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleScorecardUpload}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={scanningCard}
              className="gap-2 border-green-500 text-green-700 hover:bg-green-100 font-semibold"
              onClick={openScorecardScan}
            >
              {scanningCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Escanear tarjeta
            </Button>

            <Button
              size="sm"
              onClick={listening ? stopVoice : startVoice}
              className={`gap-2 font-bold shadow-lg transition-all ${
                listening
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  : "bg-white text-green-700 border-2 border-green-500 hover:bg-green-50"
              }`}
              title={listening ? "Detener grabación" : "Registrar evento por voz"}
            >
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? "Detener" : "Dictar"}
            </Button>
          </div>
        )}
      </div>

      {/* Panel transcripción en vivo */}
      {(listening || voiceText) && (
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-green-800">
            {listening ? (
              <><Mic className="h-4 w-4 animate-pulse" /> Escuchando… (di: "gol equipo {match.home_team.name} jugador [nombre o número]")</>
            ) : (
              "Transcripción"
            )}
          </div>
          <p className="mt-1 italic text-green-900 min-h-[1.25rem]">
            {voiceText || "Habla con naturalidad; al terminar el silencio se procesará automáticamente."}
          </p>
        </div>
      )}

      {/* Banner OCR tarjeta de árbitro */}
      {(scanningCard || scorecardText) && (
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-green-800">
            {scanningCard ? (
              <><ScanLine className="h-4 w-4 animate-pulse" /> Leyendo la tarjeta con Azure Vision…</>
            ) : (
              "Texto detectado en la tarjeta"
            )}
          </div>
          <p className="mt-1 italic text-green-900 min-h-[1.25rem] whitespace-pre-wrap max-h-40 overflow-y-auto">
            {scanningCard ? "Analizando imagen…" : scorecardText}
          </p>
          {unmatchedLines.length > 0 && (
            <div className="mt-2 text-red-700">
              <p className="font-semibold">{unmatchedLines.length} línea(s) no reconocida(s):</p>
              <ul className="list-disc list-inside">
                {unmatchedLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Marcador */}
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-xl font-bold">{match.home_team.name}</p>
              <p className="text-xs text-muted-foreground">Local</p>
            </div>
            <div className="text-center">
              <p className="text-5xl font-black">{homeScore} - {awayScore}</p>
              <p className="text-xs text-muted-foreground mt-1">Se calcula de los goles asignados</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{match.away_team.name}</p>
              <p className="text-xs text-muted-foreground">Visitante</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <p className="text-sm text-muted-foreground">No hay jugadores asignados a este equipo</p>
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
            <p className="text-sm text-muted-foreground">No hay jugadores asignados a este equipo</p>
          ) : (
            match.away_team.players.map(renderPlayerRow)
          )}
        </CardContent>
      </Card>

      {/* Guardar */}
      {writeAllowed && (
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
            Guardar resultado
          </Button>
        </div>
      )}
    </div>
  );
}
