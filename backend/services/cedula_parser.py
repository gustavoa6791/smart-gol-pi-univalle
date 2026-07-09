"""Parser de texto OCR para cédulas colombianas y documentos de identidad.

En la cédula física CO el OCR suele leer primero el VALOR y luego la ETIQUETA:
    SALAZAR BUENO
    APELLIDOS
    LAURA ISABEL
    NOMBRES

También soporta layout digital (etiqueta arriba, valor abajo) y reverso
(fecha de nacimiento, sexo).
"""
from __future__ import annotations

import re
import unicodedata

from services.player_extraction import extract_player_fields, _parse_birth_date, _norm

_LABEL_ALIASES: dict[str, list[str]] = {
    "document_number": [
        "nuip", "numero", "no.", "no", "documento", "cedula de ciudadania",
        "cedula ciudadania",
    ],
    "surnames": ["apellidos"],
    "names": ["nombres", "nombre"],
    "birth_date": ["fecha de nacimiento", "fecha nacimiento"],
    "gender": ["sexo", "genero"],
    "birth_place": ["lugar de nacimiento", "lugar nacimiento"],
    "issue_date": ["fecha y lugar de expedicion", "fecha de expedicion", "fecha expedicion"],
    "blood_type": ["g s rh", "gs rh", "rh", "grupo sanguineo", "tipo de sangre"],
}

_DOC_TYPE_PATTERNS = [
    ("CC", ["cedula de ciudadania", "cedula ciudadania", "identificacion personal"]),
    ("TI", ["tarjeta de identidad"]),
    ("CE", ["cedula de extranjeria", "cedula extranjeria"]),
    ("PA", ["pasaporte"]),
]

_MONTH_ABBR = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "set": 9, "oct": 10, "nov": 11, "dic": 12,
}

# Líneas que no son nombres aunque parezcan texto.
_NOISE_EXACT = {
    "firma", "republica de colombia", "identificacion personal",
    "cedula de ciudadania", "cedula ciudadania", "colombia", "nuip",
    "apellidos", "nombres", "numero", "sexo", "genero", "fecha de nacimiento",
    "lugar de nacimiento", "fecha y lugar de expedicion", "estatura",
    "indice derecho", "indice", "derecho", "izquierdo",
}

_NOISE_CONTAINS = (
    "republica", "colombia", "identificacion", "ciudadania", "cedula",
    "registraduria", "delegada", "expedicion", "nacimiento", "firma",
)


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _normalize_label(line: str) -> str:
    text = _strip_accents(line.lower().strip())
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _is_label(line: str) -> str | None:
    norm = _normalize_label(line)
    for key, aliases in _LABEL_ALIASES.items():
        for alias in aliases:
            if norm == alias or norm.startswith(alias + " "):
                return key
    return None


def _is_noise_line(line: str) -> bool:
    norm = _normalize_label(line)
    if not norm or norm in _NOISE_EXACT:
        return True
    if _parse_cedula_date(line):
        return False
    if re.fullmatch(r"[mf]", norm):
        return False
    if any(part in norm for part in _NOISE_CONTAINS):
        return True
    num = _parse_document_number(line)
    if num and len(num) >= 8:
        return True
    return False


def _is_person_name_line(line: str) -> bool:
    """Línea que parece nombres/apellidos en mayúsculas."""
    raw = line.strip()
    if not raw or _is_label(raw) or _is_noise_line(raw):
        return False
    if not re.match(r"^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$", raw):
        return False
    words = raw.split()
    return 1 <= len(words) <= 4 and all(len(w) >= 2 for w in words)


def _parse_document_number(text: str) -> str | None:
    digits = re.sub(r"\D", "", text)
    if 6 <= len(digits) <= 12:
        return digits
    return None


def _parse_cedula_date(text: str) -> str | None:
    """Soporta '15-SEP-2000', '15 SEP 2000', '15/03/1995', etc."""
    norm = _normalize_label(text.strip())

    patterns = [
        r"\b(\d{1,2})\s*[-/.]\s*([a-z]{3,9})\s*[-/.]\s*(\d{2,4})\b",
        r"\b(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})\b",
    ]
    for pattern in patterns:
        m = re.search(pattern, norm, flags=re.IGNORECASE)
        if m:
            day, month_raw, year_raw = int(m.group(1)), m.group(2)[:3].lower(), m.group(3)
            month = _MONTH_ABBR.get(month_raw)
            if month:
                year = int(year_raw)
                if year < 100:
                    year = 2000 + year if year <= 25 else 1900 + year
                if 1 <= day <= 31:
                    return f"{year:04d}-{month:02d}-{day:02d}"

    return _parse_birth_date(_norm(text))


def _parse_gender(text: str) -> str | None:
    norm = _normalize_label(text)
    if norm in ("m", "masculino", "hombre", "varon"):
        return "M"
    if norm in ("f", "femenino", "mujer"):
        return "F"
    return None


def _cap_name(s: str) -> str:
    return " ".join(w.capitalize() for w in s.split())


def _split_two_part_name(text: str) -> tuple[str | None, str | None]:
    words = [w for w in text.strip().split() if w]
    if not words:
        return None, None
    if len(words) == 1:
        return _cap_name(words[0]), None
    return _cap_name(words[0]), _cap_name(" ".join(words[1:]))


def _detect_document_type(full_text: str) -> str | None:
    norm = _normalize_label(full_text)
    for doc_type, patterns in _DOC_TYPE_PATTERNS:
        for p in patterns:
            if p in norm:
                return doc_type
    return None


def _values_near_label(lines: list[str], index: int) -> list[str]:
    """Valores antes y después de una etiqueta (layout CO físico y digital)."""
    values: list[str] = []

    if index > 0:
        prev = lines[index - 1].strip()
        if prev and not _is_label(prev) and not _is_noise_line(prev):
            values.append(prev)

    j = index + 1
    while j < len(lines):
        nxt = lines[j].strip()
        if _is_label(nxt):
            break
        if nxt and not _is_noise_line(nxt):
            values.append(nxt)
        j += 1

    return values


def _extract_document_number(lines: list[str], full_text: str) -> str | None:
    for line in lines:
        norm = _normalize_label(line)
        if norm.startswith("numero"):
            num = _parse_document_number(line)
            if num:
                return num
        m = re.search(r"numero\s+([\d.\s]+)", line, flags=re.IGNORECASE)
        if m:
            num = _parse_document_number(m.group(1))
            if num:
                return num

    for line in lines:
        if _is_label(line) == "document_number":
            for val in _values_near_label(lines, lines.index(line)):
                num = _parse_document_number(val)
                if num:
                    return num

    for line in lines:
        num = _parse_document_number(line)
        if num and len(num) >= 8:
            return num

    return None


def _extract_birth_date(lines: list[str], full_text: str) -> str | None:
    for i, line in enumerate(lines):
        if _is_label(line) == "birth_date":
            for val in _values_near_label(lines, i):
                bdate = _parse_cedula_date(val)
                if bdate:
                    return bdate

    for line in lines:
        bdate = _parse_cedula_date(line)
        if bdate:
            return bdate

    return None


def _extract_gender(lines: list[str], full_text: str) -> str | None:
    for i, line in enumerate(lines):
        if _is_label(line) == "gender":
            for val in _values_near_label(lines, i):
                gender = _parse_gender(val)
                if gender:
                    return gender

    norm_text = _normalize_label(full_text)
    m = re.search(r"\bsexo\b\s*([mf])\b", norm_text)
    if m:
        return m.group(1).upper()
    m = re.search(r"\b([mf])\b\s*\n\s*sexo\b", full_text, flags=re.IGNORECASE)
    if m:
        return m.group(1).upper()

    for line in lines:
        if re.fullmatch(r"[MFmf]", line.strip()):
            return line.strip().upper()

    return None


def _apply_name_field(fields: dict, key: str, text: str) -> None:
    first, second = _split_two_part_name(text)
    if key == "surnames":
        if first:
            fields["first_surname"] = first
        if second:
            fields["second_surname"] = second
    elif key == "names":
        if first:
            fields["first_name"] = first
        if second:
            fields["second_name"] = second


def parse_cedula_text(ocr_text: str) -> dict:
    """Convierte texto OCR de una cédula en campos de jugador."""
    if not ocr_text or not ocr_text.strip():
        return {}

    lines = [ln.strip() for ln in ocr_text.splitlines() if ln.strip()]
    fields: dict = {}

    doc_type = _detect_document_type(ocr_text)
    if doc_type:
        fields["document_type"] = doc_type

    doc_num = _extract_document_number(lines, ocr_text)
    if doc_num:
        fields["document_number"] = doc_num

    # Nombres/apellidos: valor en la línea anterior a la etiqueta (layout CO)
    for i, line in enumerate(lines):
        label_key = _is_label(line)
        if label_key not in ("surnames", "names"):
            continue

        candidates = _values_near_label(lines, i)
        for val in candidates:
            if _is_person_name_line(val):
                _apply_name_field(fields, label_key, val)
                break

    bdate = _extract_birth_date(lines, ocr_text)
    if bdate:
        fields["birth_date"] = bdate

    gender = _extract_gender(lines, ocr_text)
    if gender:
        fields["gender"] = gender

    # Si faltan nombres pero hay líneas nombre antes de etiquetas en orden fijo
    if not fields.get("first_surname") or not fields.get("first_name"):
        for i, line in enumerate(lines):
            if _is_label(line) == "surnames" and i > 0 and _is_person_name_line(lines[i - 1]):
                _apply_name_field(fields, "surnames", lines[i - 1])
            if _is_label(line) == "names" and i > 0 and _is_person_name_line(lines[i - 1]):
                _apply_name_field(fields, "names", lines[i - 1])

    # Respaldo genérico solo para campos que falten (sin pisar lo ya reconocido)
    if len(fields) < 3:
        fallback = extract_player_fields(ocr_text)
        for key, value in fallback.items():
            if key not in fields and key not in ("first_name", "second_name", "first_surname", "second_surname"):
                fields[key] = value

    if "document_type" not in fields and fields.get("document_number"):
        fields["document_type"] = "CC"

    return fields


def extract_fields_from_document_image(ocr_text: str) -> dict:
    """Punto de entrada: texto OCR → campos de jugador."""
    return parse_cedula_text(ocr_text) or extract_player_fields(ocr_text)
