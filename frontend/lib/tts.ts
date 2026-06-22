import api from "./api";

export async function speakText(text: string): Promise<void> {
  const response = await api.post("/tts/generate", { text }, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const audio = new Audio(url);

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo reproducir el audio"));
    };
    audio.play().catch(reject);
  });
}

export interface StandingSpeechRow {
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

export function buildStandingsSpeech(
  rows: StandingSpeechRow[],
  title = "Tabla de posiciones"
): string {
  if (rows.length === 0) {
    return "No hay datos en la tabla de posiciones.";
  }

  let text = `${title}. `;

  rows.forEach((row, index) => {
    const position = index + 1;
    const dg = row.goal_difference;
    const dgText =
      dg > 0
        ? `más ${dg}`
        : dg < 0
          ? `menos ${Math.abs(dg)}`
          : "cero";

    text += `Posición ${position}: ${row.team_name}, con ${row.points} puntos. `;
    text += `${row.played} partidos jugados, ${row.won} ganados, ${row.drawn} empatados y ${row.lost} perdidos. `;
    text += `Goles a favor ${row.goals_for}, goles en contra ${row.goals_against}, diferencia de goles ${dgText}. `;
  });

  return text;
}
