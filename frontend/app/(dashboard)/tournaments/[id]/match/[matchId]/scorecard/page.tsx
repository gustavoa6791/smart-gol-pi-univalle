"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";

interface Player {
  id: number;
  first_name: string;
  first_surname: string;
}

interface Team {
  id: number;
  name: string;
  players: Player[];
}

interface PlayerStatMini {
  player_id: number;
  jersey_number?: number | null;
}

interface MatchDetail {
  id: number;
  round: number;
  home_team: Team;
  away_team: Team;
  player_stats: PlayerStatMini[];
}

const GOAL_TALLY = 10;
const YELLOW_TALLY = 2;
const RED_TALLY = 1;

// Mitad izquierda (identidad) = 9cm, mitad derecha (stats) = 9cm (18cm total), para poder doblar la tarjeta a la mitad.
const IDENTITY_HALF_CM = 9;
const STATS_HALF_CM = 9;
const NUM_COL_CM = 2;
const NAME_COL_CM = IDENTITY_HALF_CM - NUM_COL_CM;
const TALLY_COUNT = GOAL_TALLY + YELLOW_TALLY + RED_TALLY;
const TALLY_COL_CM = 0.45;
const TOTAL_COL_CM = (STATS_HALF_CM - TALLY_COUNT * TALLY_COL_CM) / 3;

// Altura combinada de AMBAS tablas (los dos equipos juntos) = 20cm.
// Subido desde 12cm: en la práctica 0.49cm/fila hacía que la tinta de filas contiguas
// se solapara visualmente y el OCR no pudiera separar una fila de la siguiente por posición.
// 10 filas de jugador por equipo (rellenas en blanco si faltan) + 2 filas de encabezado por tabla + espacio entre tablas.
const ROWS_PER_TEAM = 10;
const COMBINED_MAX_HEIGHT_CM = 20;
const GAP_BETWEEN_TABLES_CM = 0.3;
const PER_TEAM_HEIGHT_CM = (COMBINED_MAX_HEIGHT_CM - GAP_BETWEEN_TABLES_CM) / 2;
// Todas las filas (encabezados incluidos) miden lo mismo: 2 filas de encabezado + 10 de jugador = 12 filas por equipo.
const ROWS_TOTAL_PER_TEAM = ROWS_PER_TEAM + 2;
const UNIFORM_ROW_CM = PER_TEAM_HEIGHT_CM / ROWS_TOTAL_PER_TEAM;
const HEADER_ROW_CM = UNIFORM_ROW_CM;
const DATA_ROW_CM = UNIFORM_ROW_CM;

export default function ScorecardPrintPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [jerseyByPlayer, setJerseyByPlayer] = useState<Record<number, number>>({});
  const [blankMode, setBlankMode] = useState(false);

  useEffect(() => {
    api
      .get(`/api/tournaments/matches/${matchId}/detail`)
      .then((res) => {
        const data: MatchDetail = res.data;
        setMatch(data);
        const jerseys: Record<number, number> = {};
        data.player_stats.forEach((s) => {
          if (s.jersey_number != null) jerseys[s.player_id] = s.jersey_number;
        });
        setJerseyByPlayer(jerseys);
      })
      .catch(() => toast.error("Error cargando partido"))
      .finally(() => setLoading(false));
  }, [matchId]);

  function printTemplate(blank: boolean) {
    setBlankMode(blank);
    requestAnimationFrame(() => {
      window.print();
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!match) return null;

  // height es un mínimo en tablas HTML: si el line-height del texto es mayor, la fila crece igual.
  // Fijamos font-size/line-height/box-sizing explícitos para que la altura declarada sea la real.
  const CELL_TEXT: CSSProperties = { fontSize: "16px", lineHeight: "18px", boxSizing: "border-box" };
  const rowHeightStyle: CSSProperties = { height: `${DATA_ROW_CM}cm`, ...CELL_TEXT };
  const headerRowStyle: CSSProperties = { height: `${HEADER_ROW_CM}cm`, ...CELL_TEXT };

  const tallyCell = (key: string) => (
    <td key={key} className="border border-black p-0 text-center" style={rowHeightStyle}></td>
  );

  const totalCell = (key: string) => (
    <td
      key={key}
      className="border-2 border-black p-0 text-center font-bold bg-gray-50"
      style={rowHeightStyle}
    ></td>
  );

  const renderTeamTable = (team: Team) => {
    const missingJersey = team.players.filter((p) => jerseyByPlayer[p.id] == null);
    const filledRows = Math.min(team.players.length, ROWS_PER_TEAM);
    const blankRowCount = Math.max(ROWS_PER_TEAM - filledRows, 0);

    return (
      <div className="mb-8 print:mb-0 break-inside-avoid">
        {missingJersey.length > 0 && (
          <p className="text-xs text-red-600 mb-2 print:hidden">
            {missingJersey.length} jugador(es) sin número de camiseta asignado — no se podrán auto-completar por OCR.
          </p>
        )}
        <table
          className="border-collapse border border-black"
          style={{ width: `${IDENTITY_HALF_CM + STATS_HALF_CM}cm`, tableLayout: "fixed", borderSpacing: 0 }}
        >
          <colgroup>
            <col style={{ width: `${NUM_COL_CM}cm` }} />
            <col style={{ width: `${NAME_COL_CM}cm` }} />
            {Array.from({ length: GOAL_TALLY }, (_, i) => (
              <col key={`gc${i}`} style={{ width: `${TALLY_COL_CM}cm` }} />
            ))}
            <col style={{ width: `${TOTAL_COL_CM}cm` }} />
            {Array.from({ length: YELLOW_TALLY }, (_, i) => (
              <col key={`ac${i}`} style={{ width: `${TALLY_COL_CM}cm` }} />
            ))}
            <col style={{ width: `${TOTAL_COL_CM}cm` }} />
            {Array.from({ length: RED_TALLY }, (_, i) => (
              <col key={`rc${i}`} style={{ width: `${TALLY_COL_CM}cm` }} />
            ))}
            <col style={{ width: `${TOTAL_COL_CM}cm` }} />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-black p-0 px-1 text-left" style={headerRowStyle} colSpan={2}>
                Equipo:
              </th>
              <th
                className="border border-black p-0 px-1 text-left"
                style={headerRowStyle}
                colSpan={GOAL_TALLY + YELLOW_TALLY + RED_TALLY + 3}
              >
                {blankMode ? "" : team.name}
              </th>
            </tr>
            <tr>
              <th className="border border-black p-0" style={headerRowStyle}>#</th>
              <th
                className="border border-black p-0 px-1 text-left"
                style={{ ...headerRowStyle, borderRight: "4px dashed black" }}
              >
                Nombre
              </th>
              <th colSpan={GOAL_TALLY} className="border border-black p-0" style={headerRowStyle}>Goles</th>
              <th className="border-2 border-black p-0" style={headerRowStyle}>T.G.</th>
              <th colSpan={YELLOW_TALLY} className="border border-black p-0" style={headerRowStyle}>A</th>
              <th className="border-2 border-black p-0" style={headerRowStyle}>T.A.</th>
              <th colSpan={RED_TALLY} className="border border-black p-0" style={headerRowStyle}>R</th>
              <th className="border-2 border-black p-0" style={headerRowStyle}>T.R.</th>
            </tr>
          </thead>
          <tbody>
            {!blankMode &&
              team.players.map((p) => (
                <tr key={`p${p.id}`}>
                  <td className="border border-black p-0 text-center font-bold" style={rowHeightStyle}>
                    {jerseyByPlayer[p.id] ?? ""}
                  </td>
                  <td
                    className="border border-black p-0 px-1 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ ...rowHeightStyle, borderRight: "4px dashed black" }}
                  >
                    {p.first_name} {p.first_surname}
                  </td>
                  {Array.from({ length: GOAL_TALLY }, (_, i) => tallyCell(`g${p.id}_${i}`))}
                  {totalCell(`tg${p.id}`)}
                  {Array.from({ length: YELLOW_TALLY }, (_, i) => tallyCell(`a${p.id}_${i}`))}
                  {totalCell(`ta${p.id}`)}
                  {Array.from({ length: RED_TALLY }, (_, i) => tallyCell(`r${p.id}_${i}`))}
                  {totalCell(`tr${p.id}`)}
                </tr>
              ))}
            {Array.from({ length: blankMode ? ROWS_PER_TEAM : blankRowCount }, (_, i) => (
              <tr key={`blank${i}`}>
                <td className="border border-black p-0 text-center font-bold" style={rowHeightStyle}></td>
                <td
                  className="border border-black p-0 px-1"
                  style={{ ...rowHeightStyle, borderRight: "4px dashed black" }}
                ></td>
                {Array.from({ length: GOAL_TALLY }, (_, j) => tallyCell(`bg${i}_${j}`))}
                {totalCell(`btg${i}`)}
                {Array.from({ length: YELLOW_TALLY }, (_, j) => tallyCell(`ba${i}_${j}`))}
                {totalCell(`bta${i}`)}
                {Array.from({ length: RED_TALLY }, (_, j) => tallyCell(`br${i}_${j}`))}
                {totalCell(`btr${i}`)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: portrait; margin: 0.3cm; }
        }
      `}</style>
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold">Tarjeta de árbitro — Jornada {match.round}</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => printTemplate(false)}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir plantilla (con datos)
          </Button>
          <Button size="sm" onClick={() => printTemplate(true)}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir plantilla (en blanco)
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        La tabla mide 18cm de ancho. Ambos equipos juntos suman máximo 20cm de alto (mínimo 10 filas de jugador
        por equipo, rellenas en blanco si el equipo tiene menos) para dejar espacio real de escritura entre
        filas — filas muy apretadas hacen que el OCR no pueda separar una fila de la siguiente. Los primeros
        9cm (# y Nombre) y los otros 9cm (Goles/A/R) están separados
        por una línea punteada — dobla ahí para llevarla más compacta. El árbitro marca una x en las casillas a
        medida que ocurre cada evento, y al final escribe el total en la casilla resaltada (T.G. / T.A. / T.R.).
        Solo esas casillas de total se leen por OCR — luego, en la página del partido, usa "Escanear tarjeta"
        para leerla automáticamente.
      </p>

      <div className="bg-white text-black p-6 rounded border print:border-0 print:p-0">
        {renderTeamTable(match.home_team)}
        <div className="hidden print:block" style={{ height: `${GAP_BETWEEN_TABLES_CM}cm` }} />
        {renderTeamTable(match.away_team)}
      </div>
    </div>
  );
}
