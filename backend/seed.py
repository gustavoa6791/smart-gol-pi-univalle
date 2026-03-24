import sys
import os
from datetime import date

# Add current directory to path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__))))

from database import SessionLocal
import models
from auth import hash_password

def seed_data():
    db = SessionLocal()
    try:
        # 1. Seed User
        admin_email = "admin@smartgol.com"
        existing_user = db.query(models.User).filter(models.User.email == admin_email).first()
        
        if not existing_user:
            print("🌱 Seeding admin user...")
            admin_user = models.User(
                name="Admin Smart Gol",
                email=admin_email,
                hashed_password=hash_password("admin123")
            )
            db.add(admin_user)
            db.commit()
            print("✅ Admin user created (admin@smartgol.com / admin123)")
        else:
            print("ℹ️ Admin user already exists")

        # 2. Seed Players
        if db.query(models.Player).count() == 0:
            print("🌱 Seeding initial players...")
            players = [
                models.Player(first_name="Lionel", first_surname="Messi",
                            document_type=models.DocumentType.PA, document_number="ARG10001",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1987, 6, 24)),

                models.Player(first_name="Cristiano", first_surname="Ronaldo",
                            document_type=models.DocumentType.PA, document_number="POR10002",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1985, 2, 5)),

                models.Player(first_name="Neymar", first_surname="Junior",
                            document_type=models.DocumentType.PA, document_number="BRA10003",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1992, 2, 5)),

                models.Player(first_name="Kevin", first_surname="De Bruyne",
                            document_type=models.DocumentType.PA, document_number="BEL10004",
                            position=models.PlayerPosition.midfielder,
                            gender=models.Gender.M, birth_date=date(1991, 6, 28)),

                models.Player(first_name="Virgil", first_surname="van Dijk",
                            document_type=models.DocumentType.PA, document_number="HOL10005",
                            position=models.PlayerPosition.defender,
                            gender=models.Gender.M, birth_date=date(1991, 7, 8)),

                models.Player(first_name="Emiliano", first_surname="Martínez",
                            document_type=models.DocumentType.PA, document_number="ARG10006",
                            position=models.PlayerPosition.goalkeeper,
                            gender=models.Gender.M, birth_date=date(1992, 9, 2)),

                models.Player(first_name="Kylian", first_surname="Mbappé",
                            document_type=models.DocumentType.PA, document_number="FRA10007",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1998, 12, 20)),

                models.Player(first_name="Erling", first_surname="Haaland",
                            document_type=models.DocumentType.PA, document_number="NOR10008",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(2000, 7, 21)),

                models.Player(first_name="Luka", first_surname="Modrić",
                            document_type=models.DocumentType.PA, document_number="CRO10009",
                            position=models.PlayerPosition.midfielder,
                            gender=models.Gender.M, birth_date=date(1985, 9, 9)),

                models.Player(first_name="Jude", first_surname="Bellingham",
                            document_type=models.DocumentType.PA, document_number="ENG10010",
                            position=models.PlayerPosition.midfielder,
                            gender=models.Gender.M, birth_date=date(2003, 6, 29)),

                models.Player(first_name="Rodri", first_surname="Hernández",
                            document_type=models.DocumentType.PA, document_number="ESP10011",
                            position=models.PlayerPosition.midfielder,
                            gender=models.Gender.M, birth_date=date(1996, 6, 22)),

                models.Player(first_name="Antoine", first_surname="Griezmann",
                            document_type=models.DocumentType.PA, document_number="FRA10012",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1991, 3, 21)),

                models.Player(first_name="Robert", first_surname="Lewandowski",
                            document_type=models.DocumentType.PA, document_number="POL10013",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1988, 8, 21)),

                models.Player(first_name="Mohamed", first_surname="Salah",
                            document_type=models.DocumentType.PA, document_number="EGY10014",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(1992, 6, 15)),

                models.Player(first_name="Vinícius", first_surname="Júnior",
                            document_type=models.DocumentType.PA, document_number="BRA10015",
                            position=models.PlayerPosition.forward,
                            gender=models.Gender.M, birth_date=date(2000, 7, 12)),

                models.Player(first_name="Rúben", first_surname="Dias",
                            document_type=models.DocumentType.PA, document_number="POR10016",
                            position=models.PlayerPosition.defender,
                            gender=models.Gender.M, birth_date=date(1997, 5, 14)),

                models.Player(first_name="Achraf", first_surname="Hakimi",
                            document_type=models.DocumentType.PA, document_number="MAR10017",
                            position=models.PlayerPosition.defender,
                            gender=models.Gender.M, birth_date=date(1998, 11, 4)),

                models.Player(first_name="Alisson", first_surname="Becker",
                            document_type=models.DocumentType.PA, document_number="BRA10018",
                            position=models.PlayerPosition.goalkeeper,
                            gender=models.Gender.M, birth_date=date(1992, 10, 2)),

                models.Player(first_name="Thibaut", first_surname="Courtois",
                            document_type=models.DocumentType.PA, document_number="BEL10019",
                            position=models.PlayerPosition.goalkeeper,
                            gender=models.Gender.M, birth_date=date(1992, 5, 11)),

                models.Player(first_name="Pedri", first_surname="González",
                            document_type=models.DocumentType.PA, document_number="ESP10020",
                            position=models.PlayerPosition.midfielder,
                            gender=models.Gender.M, birth_date=date(2002, 11, 25)),
            ]
            db.add_all(players)
            db.commit()
            print(f"✅ Created {len(players)} players")
        else:
            print("ℹ️ Players already exist, skipping...")

        # 3. Seed Teams
        if db.query(models.Team).count() == 0:
            players = db.query(models.Player).all()

            team1 = models.Team(name="Real Valle", category=models.TeamCategory.senior, coach_name="Carlos Pérez")
            team2 = models.Team(name="Deportivo Cali Norte", category=models.TeamCategory.senior, coach_name="Juan Gómez")
            team3 = models.Team(name="Atlético Pacífico", category=models.TeamCategory.senior, coach_name="Luis Torres")
            team4 = models.Team(name="Unión Cauca FC", category=models.TeamCategory.senior, coach_name="Andrés Ruiz")

            team1.players = players[0:5]
            team2.players = players[5:10]
            team3.players = players[10:15]
            team4.players = players[15:20]

            db.add_all([team1, team2, team3, team4])
            db.flush()

            team1.leader_id = players[0].id
            team2.leader_id = players[5].id
            team3.leader_id = players[10].id
            team4.leader_id = players[15].id

            db.commit()
            print("✅ Creating teams...")
        else:
            print("ℹ️ Teams already exist")
        
        # 4. Seed Tournament Templates
        if db.query(models.TournamentTemplate).count() == 0:

            templates = [
                models.TournamentTemplate(
                    name="Liga simple",
                    is_home_away=0
                ),
                models.TournamentTemplate(
                    name="Liga ida y vuelta",
                    is_home_away=1
                )
            ]

            db.add_all(templates)
            db.commit()
            print("✅ Creating templates...")
        else:
            print("ℹ️ Templates already exist")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
