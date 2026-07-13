"""Parser de texto OCR para la tarjeta física de árbitro.

Primera versión (línea de texto de Azure = fila de jugador) falló en la
práctica: la tabla impresa es ancha (18cm) con celdas muy separadas entre sí
(# de camiseta, nombre, 10 casillas de gol, luego totales), así que Azure Read
agrupa "líneas" por cercanía visual y termina partiendo una fila física en
muchos fragmentos de texto no contiguos — el resultado es basura sin relación
fila↔jugador.

Esta versión reconstruye las filas usando la posición (bounding box) de cada
palabra/dígito reconocido en vez de confiar en el agrupamiento de líneas de
Azure:

1. Separar las palabras en dos mitades por la mediana del rango vertical total
   (la plantilla siempre imprime el equipo local completo arriba y el
   visitante abajo).
2. Dentro de cada mitad, agrupar palabras en "renglones" por proximidad real
   en Y (no por líneas de Azure).
3. Dentro de cada renglón, ordenar por X y aplicar la misma heurística de
   siempre: primer token de 1-2 dígitos = número de camiseta; de los tokens
   restantes, los últimos 3 que sean un solo dígito = goles, amarillas, rojas
   (T.G./T.A./T.R., en ese orden posicional).
"""
from __future__ import annotations

import re
import statistics

_JERSEY_TOKEN = re.compile(r"^\d{1,2}$")

# Azure Read devuelve confidence 0-1 por palabra. Por debajo de este umbral,
# el dígito se marca como dudoso para que el árbitro/organizador lo revise
# antes de guardar (la ambigüedad de caligrafía no se resuelve con más código).
LOW_CONFIDENCE_THRESHOLD = 0.7


def _cluster_rows(words: list[dict]) -> list[list[dict]]:
    """Agrupa palabras en renglones por proximidad en Y."""
    if not words:
        return []

    ordered = sorted(words, key=lambda w: w["cy"])
    heights = [w["height"] for w in ordered if w["height"] > 0]
    threshold = (statistics.median(heights) if heights else 10) * 0.7

    rows: list[list[dict]] = [[ordered[0]]]
    row_cy = ordered[0]["cy"]
    for w in ordered[1:]:
        if w["cy"] - row_cy > threshold:
            rows.append([])
        rows[-1].append(w)
        row_cy = sum(x["cy"] for x in rows[-1]) / len(rows[-1])

    return rows


def _parse_row(row: list[dict]) -> tuple[int, dict] | None:
    tokens = sorted(row, key=lambda w: w["cx"])

    jersey = None
    jersey_idx = None
    for i, tok in enumerate(tokens):
        if _JERSEY_TOKEN.match(tok["text"]):
            jersey = int(tok["text"])
            jersey_idx = i
            break
    if jersey is None:
        return None

    # Los totales a veces quedan pegados a una marca "x" de conteo en el mismo
    # token OCR (p. ej. "3X", "0X1", "2XX") porque el dígito escrito a mano
    # queda muy cerca de la casilla de tally vecina. En vez de exigir que el
    # token entero sea un solo dígito, se extrae cada carácter numérico
    # individual de los tokens restantes (junto con la confianza de su token
    # de origen), en orden — así "0X1" aporta los dígitos 0 y 1 por separado
    # en vez de descartarse entero.
    #
    # Nota: se probó marcar como "sospechoso" cualquier token de 2+ dígitos
    # puros (p. ej. "10", pensando que sería un dígito mal partido en dos). Se
    # revirtió: un total de 10 goles es válido (hay 10 casillas de tally), así
    # que esa regla no puede distinguir "OCR partió mal un dígito" de "de verdad
    # anotó 10 goles" — solo agregaba falsos positivos sobre valores correctos.
    rest = tokens[jersey_idx + 1:]
    digits: list[tuple[str, float]] = [
        (c, tok.get("confidence", 1.0)) for tok in rest for c in tok["text"] if c.isdigit()
    ]
    if len(digits) < 3:
        return None

    last_three = digits[-3:]
    (goals, goals_conf), (yellow, yellow_conf), (red, red_conf) = last_three
    return jersey, {
        "goals": int(goals),
        "yellow_cards": int(yellow),
        "red_cards": int(red),
        "low_confidence": {
            "goals": goals_conf < LOW_CONFIDENCE_THRESHOLD,
            "yellow_cards": yellow_conf < LOW_CONFIDENCE_THRESHOLD,
            "red_cards": red_conf < LOW_CONFIDENCE_THRESHOLD,
        },
    }


def _row_text(row: list[dict]) -> str:
    return " ".join(w["text"] for w in sorted(row, key=lambda w: w["cx"]))


def parse_scorecard_words(
    words: list[dict],
) -> tuple[dict[str, dict[int, dict]], list[str]]:
    """Convierte palabras OCR (con posición) en stats por número de camiseta.

    Devuelve ({"home": {jersey: stats}, "away": {jersey: stats}}, líneas_no_reconocidas).
    "home" = mitad superior de la foto, "away" = mitad inferior (así se imprime la tarjeta).
    """
    result: dict[str, dict[int, dict[str, int]]] = {"home": {}, "away": {}}
    unmatched: list[str] = []

    if not words:
        return result, unmatched

    # Cortar por el mayor espacio vertical vacío (el hueco real entre ambas
    # tablas), no por la mediana: la mediana puede caer dentro de una fila si
    # esta queda cerca del centro de la foto, partiendo nombre y dígitos entre
    # equipos distintos.
    ys = sorted(w["cy"] for w in words)
    if len(ys) < 2:
        split_y = ys[0] if ys else 0.0
    else:
        gaps = [(ys[i + 1] - ys[i], i) for i in range(len(ys) - 1)]
        _, gap_idx = max(gaps)
        split_y = (ys[gap_idx] + ys[gap_idx + 1]) / 2

    halves = {
        "home": [w for w in words if w["cy"] <= split_y],
        "away": [w for w in words if w["cy"] > split_y],
    }

    for key, half_words in halves.items():
        for row in _cluster_rows(half_words):
            parsed = _parse_row(row)
            if parsed is None:
                unmatched.append(_row_text(row))
                continue
            jersey, stats = parsed
            result[key][jersey] = stats

    return result, unmatched
