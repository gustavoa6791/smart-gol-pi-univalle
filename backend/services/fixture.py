import math
import random


def _next_power_of_2(n):
    if n <= 1:
        return 1
    return 2 ** math.ceil(math.log2(n))


def _phase_name(total_rounds, current_round_from_end):
    phases = ["final", "semifinal", "quarterfinal", "round_of_16"]
    if current_round_from_end < len(phases):
        return phases[current_round_from_end]
    return "round_of_16"


# ─── ROUND ROBIN ────────────────────────────────────────────────────────────

def generate_round_robin(teams, is_home_away=False):
    """
    Genera fixture todos contra todos.
    Recibe lista de objetos team (con .id).
    Retorna lista de rondas, cada ronda es lista de tuplas (home, away).
    """
    team_list = list(teams)
    if len(team_list) % 2 != 0:
        team_list.append(None)

    n = len(team_list)
    rounds = []

    for r in range(n - 1):
        matches = []
        for i in range(n // 2):
            t1 = team_list[i]
            t2 = team_list[n - 1 - i]
            if t1 is not None and t2 is not None:
                matches.append((t1, t2))
        team_list = [team_list[0]] + [team_list[-1]] + team_list[1:-1]
        rounds.append(matches)

    if not is_home_away:
        return rounds

    second_leg = [
        [(away, home) for (home, away) in round_matches]
        for round_matches in rounds
    ]
    return rounds + second_leg


# Mantener la funcion original para backward compatibility
def generate_fixture(teams, is_home_away):
    return generate_round_robin(teams, is_home_away=bool(is_home_away))


# ─── KNOCKOUT ────────────────────────────────────────────────────────────────

def generate_knockout_bracket(teams, is_home_away=False, third_place=False, final_legs=None, third_place_legs=None):
    """
    Genera bracket de eliminatoria directa.
    is_home_away: ida/vuelta para rondas normales.
    final_legs: 1 o 2 partidos para la final (override de is_home_away).
    third_place_legs: 1 o 2 partidos para tercer puesto.
    """
    if final_legs is None:
        final_legs = 2 if is_home_away else 1
    if third_place_legs is None:
        third_place_legs = 1
    team_list = list(teams)
    random.shuffle(team_list)

    n = len(team_list)
    bracket_size = _next_power_of_2(n)
    total_rounds = int(math.log2(bracket_size))

    slots = []
    for i in range(bracket_size):
        slots.append(team_list[i] if i < n else None)

    # Primero generar estructura single-leg para la logica del bracket
    all_ties = []  # cada "tie" es una llave (puede tener 1 o 2 partidos)
    round_tie_indices = []

    for round_num in range(1, total_rounds + 1):
        round_from_end = total_rounds - round_num
        phase = _phase_name(total_rounds, round_from_end)
        round_indices = []

        if round_num == 1:
            for i in range(0, bracket_size, 2):
                t1 = slots[i]
                t2 = slots[i + 1]
                tie = {
                    "home_team_id": t1.id if t1 else None,
                    "away_team_id": t2.id if t2 else None,
                    "round": round_num,
                    "phase": phase,
                    "bracket_position": i // 2 + 1,
                    "next_tie_index": None,
                    "is_bye": t1 is None or t2 is None,
                }
                round_indices.append(len(all_ties))
                all_ties.append(tie)
        else:
            num_ties = bracket_size // (2 ** round_num)
            for pos in range(num_ties):
                tie = {
                    "home_team_id": None,
                    "away_team_id": None,
                    "round": round_num,
                    "phase": phase,
                    "bracket_position": pos + 1,
                    "next_tie_index": None,
                    "is_bye": False,
                }
                round_indices.append(len(all_ties))
                all_ties.append(tie)

        round_tie_indices.append(round_indices)

    # Enlazar llaves
    for r_idx in range(len(round_tie_indices) - 1):
        current = round_tie_indices[r_idx]
        next_r = round_tie_indices[r_idx + 1]
        for i, tie_idx in enumerate(current):
            all_ties[tie_idx]["next_tie_index"] = next_r[i // 2]

    # Auto-avanzar byes
    for tie in all_ties:
        if tie["is_bye"] and tie["next_tie_index"] is not None:
            winner_id = tie["home_team_id"] or tie["away_team_id"]
            if winner_id:
                next_tie = all_ties[tie["next_tie_index"]]
                if next_tie["home_team_id"] is None:
                    next_tie["home_team_id"] = winner_id
                else:
                    next_tie["away_team_id"] = winner_id

    # Filtrar byes
    filtered_ties = []
    tie_index_map = {}
    for i, tie in enumerate(all_ties):
        if not tie["is_bye"]:
            tie_index_map[i] = len(filtered_ties)
            filtered_ties.append(tie)

    for tie in filtered_ties:
        old_next = tie.get("next_tie_index")
        if old_next is not None and old_next in tie_index_map:
            tie["next_tie_index"] = tie_index_map[old_next]
        else:
            tie["next_tie_index"] = None

    # Determinar cuantos legs tiene cada fase
    def _legs_for_phase(phase):
        if phase == "final":
            return final_legs
        if phase == "third_place":
            return third_place_legs
        return 2 if is_home_away else 1

    # Expandir llaves a partidos (1 o 2 por llave segun fase)
    result = []
    tie_to_match_indices = {}

    for tie_idx, tie in enumerate(filtered_ties):
        match_indices = []
        num_legs = _legs_for_phase(tie["phase"])
        two_legs = num_legs == 2

        m1 = {
            "home_team_id": tie["home_team_id"],
            "away_team_id": tie["away_team_id"],
            "round": tie["round"],
            "leg": 1 if two_legs else None,
            "phase": tie["phase"],
            "bracket_position": tie["bracket_position"],
            "next_match_index": None,
        }
        match_indices.append(len(result))
        result.append(m1)

        if two_legs:
            m2 = {
                "home_team_id": tie["away_team_id"],
                "away_team_id": tie["home_team_id"],
                "round": tie["round"],
                "leg": 2,
                "phase": tie["phase"],
                "bracket_position": tie["bracket_position"],
                "next_match_index": None,
            }
            match_indices.append(len(result))
            result.append(m2)

        tie_to_match_indices[tie_idx] = match_indices

    # Enlazar next_match_index
    for tie_idx, tie in enumerate(filtered_ties):
        next_tie_idx = tie["next_tie_index"]
        if next_tie_idx is not None and next_tie_idx in tie_to_match_indices:
            next_first_match = tie_to_match_indices[next_tie_idx][0]
            for match_idx in tie_to_match_indices[tie_idx]:
                result[match_idx]["next_match_index"] = next_first_match

    # Tercer puesto
    if third_place and total_rounds >= 2:
        tp_two_legs = third_place_legs == 2
        tp1 = {
            "home_team_id": None,
            "away_team_id": None,
            "round": total_rounds,
            "leg": 1 if tp_two_legs else None,
            "phase": "third_place",
            "bracket_position": 1,
            "next_match_index": None,
        }
        result.append(tp1)
        if tp_two_legs:
            tp2 = {
                "home_team_id": None,
                "away_team_id": None,
                "round": total_rounds,
                "leg": 2,
                "phase": "third_place",
                "bracket_position": 1,
                "next_match_index": None,
            }
            result.append(tp2)

    return result


# ─── MIXED ──────────────────────────────────────────────────────────────────

def generate_mixed_fixture(teams, num_groups, teams_advance, is_home_away=False, third_place=False, final_legs=1, third_place_legs=1):
    """
    Fase de grupos (round-robin) + bracket knockout vacio.
    ida/vuelta aplica a la fase de grupos. Knockout siempre es single match.
    """
    team_list = list(teams)
    random.shuffle(team_list)

    groups = [[] for _ in range(num_groups)]
    for i, team in enumerate(team_list):
        groups[i % num_groups].append(team)

    group_names = [chr(65 + i) for i in range(num_groups)]

    group_matches = []
    round_offset = 0
    for g_idx, group_teams in enumerate(groups):
        rounds = generate_round_robin(group_teams, is_home_away)
        total_rounds = len(rounds)
        first_leg_count = total_rounds // 2 if is_home_away else total_rounds
        for round_num, matches in enumerate(rounds, start=1):
            leg = None
            if is_home_away:
                leg = 1 if round_num <= first_leg_count else 2
            for home, away in matches:
                group_matches.append({
                    "home_team_id": home.id,
                    "away_team_id": away.id,
                    "round": round_offset + round_num,
                    "leg": leg,
                    "phase": "group",
                    "group_name": group_names[g_idx],
                    "bracket_position": None,
                    "next_match_index": None,
                })
        if rounds:
            round_offset += len(rounds)

    # Bracket knockout vacio (siempre single match)
    total_knockout_teams = num_groups * teams_advance

    class _Slot:
        def __init__(self, id):
            self.id = None

    fake_teams = [_Slot(i) for i in range(total_knockout_teams)]
    knockout_matches = generate_knockout_bracket(
        fake_teams, is_home_away=False, third_place=third_place,
        final_legs=final_legs, third_place_legs=third_place_legs,
    )

    for match in knockout_matches:
        match["round"] = round_offset + match["round"]

    return {
        "group_matches": group_matches,
        "knockout_matches": knockout_matches,
    }
