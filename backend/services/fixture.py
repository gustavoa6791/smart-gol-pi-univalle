def generate_round_robin(teams):
    """
    Genera fixture todos contra todos (ida)
    """
    if len(teams) % 2 != 0:
        teams.append(None)  # descanso

    n = len(teams)
    rounds = []

    for r in range(n - 1):
        matches = []

        for i in range(n // 2):
            t1 = teams[i]
            t2 = teams[n - 1 - i]

            if t1 is not None and t2 is not None:
                matches.append((t1, t2))

        # rotación (excepto el primero)
        teams = [teams[0]] + [teams[-1]] + teams[1:-1]

        rounds.append(matches)

    return rounds


def generate_fixture(teams, is_home_away):
    first_leg = generate_round_robin(teams.copy())

    if is_home_away == 0:
        return first_leg

    # ida y vuelta
    second_leg = [
        [(away, home) for (home, away) in round_matches]
        for round_matches in first_leg
    ]

    return first_leg + second_leg