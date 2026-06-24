import api from "./api";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let abortController: AbortController | null = null;
let onPlaybackEnd: (() => void) | null = null;

function cleanupAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export function stopSpeech() {
  abortController?.abort();
  abortController = null;
  cleanupAudio();
  onPlaybackEnd?.();
  onPlaybackEnd = null;
}

export function pauseSpeech() {
  currentAudio?.pause();
}

export function resumeSpeech() {
  void currentAudio?.play();
}

export function isSpeechPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

export function isSpeechPaused(): boolean {
  return currentAudio !== null && currentAudio.paused;
}

export function isSpeechActive(): boolean {
  return currentAudio !== null;
}

export async function speakText(
  text: string,
  callbacks?: { onStart?: () => void }
): Promise<void> {
  stopSpeech();

  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    const response = await api.post("/tts/generate", { text }, {
      responseType: "blob",
      signal,
    });

    if (signal.aborted) return;

    currentUrl = URL.createObjectURL(response.data);
    currentAudio = new Audio(currentUrl);

    await new Promise<void>((resolve, reject) => {
      onPlaybackEnd = resolve;

      currentAudio!.onended = () => {
        cleanupAudio();
        onPlaybackEnd = null;
        resolve();
      };
      currentAudio!.onerror = () => {
        cleanupAudio();
        onPlaybackEnd = null;
        reject(new Error("No se pudo reproducir el audio"));
      };
      currentAudio!.play()
        .then(() => callbacks?.onStart?.())
        .catch(reject);
    });
  } catch (err: unknown) {
    if (signal.aborted) return;
    cleanupAudio();
    onPlaybackEnd = null;
    throw err;
  } finally {
    abortController = null;
  }
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
