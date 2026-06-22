"""Extracción por reglas: convierte texto dictado en campos de un jugador.

PLUGGABLE: este módulo aísla toda la lógica de "texto -> campos". Para subir a
un LLM (Azure OpenAI / Gemini / Claude) más adelante, basta reemplazar el cuerpo
de `extract_player_fields()` por una llamada al modelo que devuelva el MISMO
dict; no hay que tocar el router ni el frontend.

Devuelve un dict con un subconjunto de los campos de PlayerCreate:
  first_name, second_name, first_surname, second_surname,
  document_type (CC|TI|CE|PA), document_number, position (enum),
  birth_date (YYYY-MM-DD), phone, email, address, gender (M|F|O), notes

Solo incluye las claves que logró reconocer. Lo demás queda para que el
usuario lo complete a mano (modo libre + revisión).
"""
import re
import unicodedata

# ── Diccionarios de sinónimos (habla) -> valor del enum del backend ──────────
# El orden importa donde hay frases que se contienen entre sí (las largas van
# primero para no quedar atrapadas por una corta).

POSITION_SYNONYMS = [
    ("goalkeeper", ["portero", "portera", "arquero", "arquera", "guardameta", "golero"]),
    ("midfielder", ["mediocampista", "medio campista", "mediocentro", "media punta",
                    "mediapunta", "volante", "contencion", "medio"]),
    ("defender", ["defensa central", "defensa", "defensor", "defensora", "central",
                  "lateral", "zaguero", "marcador"]),
    ("forward", ["delantero", "delantera", "atacante", "punta", "extremo",
                 "goleador", "ariete"]),
]

GENDER_SYNONYMS = [
    ("F", ["femenino", "femenina", "mujer"]),
    ("M", ["masculino", "masculina", "hombre", "varon"]),
    ("O", ["no binario", "no binaria", "otro genero", "otro"]),
]

# Frases largas primero: "tarjeta de identidad" antes que "cedula", etc.
DOC_TYPE_SYNONYMS = [
    ("TI", ["tarjeta de identidad", "tarjeta"]),
    ("CE", ["cedula de extranjeria", "extranjeria"]),
    ("PA", ["pasaporte"]),
    ("CC", ["cedula de ciudadania", "cedula", "documento de identidad", "documento"]),
]

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

# Para reconstruir números dictados en palabras ("tres cero cero" -> "300").
DIGIT_WORDS = {
    "cero": "0", "uno": "1", "una": "1", "dos": "2", "tres": "3", "cuatro": "4",
    "cinco": "5", "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
}

# Partículas que se pegan al apellido siguiente ("de la cruz").
NAME_PARTICLES = {"de", "del", "la", "las", "los", "san", "santa", "di", "da", "do", "dos", "y", "e"}
# Muletillas comunes al inicio del dictado, antes del nombre (sin acentos).
NAME_LEAD_NOISE = {"el", "la", "jugador", "jugadora", "se", "llama", "llame", "nombre",
                   "es", "senor", "senora", "don", "dona", "registrar", "registra",
                   "nuevo", "nueva", "hola", "quiero", "crear", "agregar", "anadir",
                   "un", "una", "que", "por", "favor", "necesito", "vamos", "a"}
# Marcadores explícitos del nombre: lo que sigue es el nombre del jugador.
NAME_MARKERS = r"(?:se\s+llaman?|se\s+llame|llamad[oa]|de\s+nombre|nombre\s+(?:completo\s+|del\s+jugador\s+)?es)"

# Palabras-clave que marcan el FIN del nombre y el inicio de los datos.
# El nombre se asume dictado primero; cortamos al primer keyword que aparezca.
_FIELD_KEYWORDS = [
    *[w for _, ws in POSITION_SYNONYMS for w in ws],
    *[w for _, ws in GENDER_SYNONYMS for w in ws],
    *[w for _, ws in DOC_TYPE_SYNONYMS for w in ws],
    "genero", "sexo", "nacido", "nacida", "nacio", "nace", "nacimiento", "fecha",
    "telefono", "celular", "movil", "numero", "correo", "email", "arroba",
    "direccion", "vive", "notas", "observaciones", "posicion", "juega",
]


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _norm(text: str) -> str:
    """minúsculas, sin acentos, sin signos de puntuación sobrantes."""
    text = _strip_accents(text.lower())
    text = text.replace(",", " ").replace(".", " . ")  # conservar punto p/ separar
    return re.sub(r"\s+", " ", text).strip()


def _first_keyword_index(norm_text: str) -> int:
    """Posición (en caracteres) del primer keyword de datos. -1 si no hay."""
    best = -1
    for kw in _FIELD_KEYWORDS:
        m = re.search(rf"\b{re.escape(kw)}\b", norm_text)
        if m and (best == -1 or m.start() < best):
            best = m.start()
    return best


def _grab_number(segment: str, max_len: int = 15) -> str | None:
    """Extrae un número de un trozo de texto: dígitos directos o palabras-dígito.

    Toma el PRIMER grupo contiguo de dígitos (admite espacios internos, p.ej.
    "300 123 4567"), sin cruzar palabras intermedias como "nacido" o "de".
    """
    # 1) dígitos directos (Azure suele transcribir números como cifras)
    m = re.search(r"\d[\d ]*\d|\d", segment)
    if m:
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) >= 6:
            return digits[:max_len]
    # 2) secuencia de palabras-dígito ("tres cero cero uno ...")
    words = []
    for tok in segment.split():
        if tok in DIGIT_WORDS:
            words.append(DIGIT_WORDS[tok])
        elif words:  # ya empezó la secuencia y se cortó
            break
    joined = "".join(words)
    if len(joined) >= 6:
        return joined[:max_len]
    return None


def _parse_birth_date(norm_text: str) -> str | None:
    """Devuelve YYYY-MM-DD o None. Soporta '5 de marzo de 1998', '15/03/1998', etc."""
    def _year(y: str) -> int:
        y = int(y)
        if y >= 100:
            return y
        # 2 dígitos: pivote en 25 (born '00-'25 -> 2000s, '26-'99 -> 1900s)
        return 2000 + y if y <= 25 else 1900 + y

    # "5 de marzo de 1998" / "5 de marzo del 98"
    m = re.search(r"\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de[l]?\s+)?(\d{2,4})\b", norm_text)
    if m and m.group(2) in MONTHS:
        d, mes, y = int(m.group(1)), MONTHS[m.group(2)], _year(m.group(3))
        if 1 <= d <= 31:
            return f"{y:04d}-{mes:02d}-{d:02d}"
    # "15/03/1998" o "15-03-1998" (asumimos día/mes/año, convención CO)
    m = re.search(r"\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b", norm_text)
    if m:
        d, mes, y = int(m.group(1)), int(m.group(2)), _year(m.group(3))
        if 1 <= d <= 31 and 1 <= mes <= 12:
            return f"{y:04d}-{mes:02d}-{d:02d}"
    return None


def _parse_email(raw_text: str, norm_text: str) -> str | None:
    # email "normal" ya escrito por el STT
    m = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", raw_text)
    if m:
        return m.group(0).lower()
    # dictado: "juan arroba gmail punto com"
    if "arroba" in norm_text:
        seg = norm_text.split("arroba", 1)
        user = seg[0].split()[-1] if seg[0].split() else ""
        rest = seg[1].replace(" punto ", ".").replace(" guion ", "-").strip()
        domain = rest.split()[0] if rest.split() else ""
        if user and "." in domain:
            return f"{user}@{domain}".lower()
    return None


def _match_synonym(norm_text: str, table) -> str | None:
    for value, words in table:
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", norm_text):
                return value
    return None


def _extract_name(raw_text: str, norm_text: str) -> dict:
    """Devuelve {first_name, second_name, first_surname, second_surname}.

    Prioriza un marcador explícito ("...se llame X..."); si no hay, toma el
    prefijo antes del primer keyword de datos. Recorta a fin de oración para no
    arrastrar lo que viene después del nombre.
    """
    m = re.search(NAME_MARKERS + r"\s+(.+)", norm_text)
    if m:
        region = m.group(1)
    else:
        cut = _first_keyword_index(norm_text)
        region = norm_text[:cut] if cut != -1 else norm_text

    region = region.split(" . ")[0]       # cortar en el primer punto (fin de oración)
    kw = _first_keyword_index(region)      # y antes del primer dato (posicion, etc.)
    if kw != -1:
        region = region[:kw]

    # tokens en minúscula-sin-acento, descartando muletillas y puntuación
    raw_tokens = [t for t in re.split(r"\s+", region) if t and t != "."]
    # quitar muletillas de arranque
    while raw_tokens and raw_tokens[0] in NAME_LEAD_NOISE:
        raw_tokens.pop(0)
    # solo palabras alfabéticas
    tokens = [t for t in raw_tokens if t.isalpha()]
    if not tokens:
        return {}

    # unir partículas con el token siguiente: ["de","la","cruz"] -> ["de la cruz"]
    merged = []
    buf = []
    for t in tokens:
        if t in NAME_PARTICLES:
            buf.append(t)
        else:
            merged.append(" ".join(buf + [t]) if buf else t)
            buf = []
    if buf and merged:  # partícula colgante al final -> pegar al anterior
        merged[-1] = merged[-1] + " " + " ".join(buf)

    def cap(s: str) -> str:
        return " ".join(w.capitalize() for w in s.split())

    parts = [cap(p) for p in merged]
    out = {}
    n = len(parts)
    if n == 1:
        out["first_name"] = parts[0]
    elif n == 2:
        out["first_name"], out["first_surname"] = parts
    elif n == 3:
        # convención CO frecuente: 1 nombre + 2 apellidos
        out["first_name"], out["first_surname"], out["second_surname"] = parts
    else:  # 4+: 2 nombres + 2 apellidos (el resto se pega al 2º apellido)
        out["first_name"] = parts[0]
        out["second_name"] = parts[1]
        out["first_surname"] = parts[2]
        out["second_surname"] = " ".join(parts[3:])
    return out


def extract_player_fields(text: str) -> dict:
    """Punto de entrada. text = transcripción cruda del STT. -> dict de campos."""
    if not text or not text.strip():
        return {}

    raw = text.strip()
    raw_noacc = _strip_accents(raw)  # conserva mayúsculas/espacios, sin acentos
    norm = _norm(raw)
    fields: dict = {}

    # Nombre / apellidos
    fields.update(_extract_name(raw, norm))

    # Enums por sinónimos
    pos = _match_synonym(norm, POSITION_SYNONYMS)
    if pos:
        fields["position"] = pos
    doc_type = _match_synonym(norm, DOC_TYPE_SYNONYMS)
    if doc_type:
        fields["document_type"] = doc_type
    # género: preferir contexto "genero/sexo X"; si no, tokens explícitos
    gen = None
    mg = re.search(r"\b(?:genero|sexo)\b(.{0,20})", norm)
    if mg:
        gen = _match_synonym(mg.group(1), GENDER_SYNONYMS)
    if not gen:
        # match directo, pero "otro" es ambiguo: solo con contexto previo
        for value, words in GENDER_SYNONYMS:
            if value == "O":
                continue
            if any(re.search(rf"\b{re.escape(w)}\b", norm) for w in words):
                gen = value
                break
    if gen:
        fields["gender"] = gen

    # Fecha de nacimiento
    bdate = _parse_birth_date(norm)
    if bdate:
        fields["birth_date"] = bdate

    # Email
    email = _parse_email(raw, norm)
    if email:
        fields["email"] = email

    # Teléfono (contexto explícito o celular CO de 10 dígitos que empieza por 3)
    phone = None
    mp = re.search(r"\b(?:telefono|celular|movil|numero de telefono|numero de celular)\b(.{0,80})", norm)
    if mp:
        phone = _grab_number(mp.group(1))
    if not phone:
        m10 = re.search(r"\b(3\d{9})\b", re.sub(r"[^\d]", " ", norm))
        if m10:
            phone = m10.group(1)
    if phone:
        fields["phone"] = phone

    # Número de documento (contexto explícito; evita pisar el teléfono).
    # OJO: no usamos "numero" a secas como keyword porque captura cosas como
    # "número 4288" de una dirección; exigimos contexto de documento real.
    doc_num = None
    md = re.search(r"\b(?:cedula|documento|numero de documento|tarjeta|pasaporte)\b(.{0,80})", norm)
    if md:
        cand = _grab_number(md.group(1))
        if cand and len(cand) >= 6 and cand != phone:
            doc_num = cand
    if not doc_num:
        # respaldo: cualquier número de 8-11 dígitos que no sea el teléfono
        for mnum in re.finditer(r"\b(\d{8,11})\b", re.sub(r"[^\d]", " ", norm)):
            if mnum.group(1) != phone:
                doc_num = mnum.group(1)
                break
    if doc_num:
        fields["document_number"] = doc_num

    # Dirección (texto libre tras "direccion"/"vive en", hasta el siguiente punto)
    # Se busca sobre raw_noacc para que "dirección" (con acento) matchee.
    ma = re.search(r"\b(?:direccion|vive en|vive)\b(.+)", raw_noacc, flags=re.IGNORECASE)
    if ma:
        addr = ma.group(1).split(".")[0].strip(" :,-")
        # cortar si aparece otra etiqueta de campo
        addr = re.split(r"\b(?:notas|observaciones|telefono|celular)\b", addr, flags=re.IGNORECASE)[0].strip(" :,-")
        if addr:
            fields["address"] = addr

    # Notas / observaciones (texto libre al final)
    mn = re.search(r"\b(?:notas|observaciones)\b(.+)", raw_noacc, flags=re.IGNORECASE)
    if mn:
        note = mn.group(1).split(".")[0].strip(" :,-")
        if note:
            fields["notes"] = note

    # Pierna hábil -> notas (descripción común de un jugador)
    if "notes" not in fields:
        mp2 = re.search(r"pierna.{0,40}?\b(zurda|diestra|derecha|izquierda)\b",
                        raw_noacc, flags=re.IGNORECASE | re.DOTALL)
        if mp2:
            fields["notes"] = f"Pierna hábil: {mp2.group(1).lower()}"

    return fields
