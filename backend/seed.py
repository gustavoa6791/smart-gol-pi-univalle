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
                # Originales
                models.Player(name="Lionel", surname="Messi", number=10,
                            position=models.PlayerPosition.forward,
                            nationality="Argentina", birth_date=date(1987, 6, 24)),
                
                models.Player(name="Cristiano", surname="Ronaldo", number=7,
                            position=models.PlayerPosition.forward,
                            nationality="Portugal", birth_date=date(1985, 2, 5)),
                
                models.Player(name="Neymar", surname="Junior", number=11,
                            position=models.PlayerPosition.forward,
                            nationality="Brasil", birth_date=date(1992, 2, 5)),
                
                models.Player(name="Kevin", surname="De Bruyne", number=17,
                            position=models.PlayerPosition.midfielder,
                            nationality="Bélgica", birth_date=date(1991, 6, 28)),
                
                models.Player(name="Virgil", surname="van Dijk", number=4,
                            position=models.PlayerPosition.defender,
                            nationality="Holanda", birth_date=date(1991, 7, 8)),
                
                models.Player(name="Emiliano", surname="Martínez", number=23,
                            position=models.PlayerPosition.goalkeeper,
                            nationality="Argentina", birth_date=date(1992, 9, 2)),
                
                # Nuevos jugadores
                models.Player(name="Kylian", surname="Mbappé", number=9,
                            position=models.PlayerPosition.forward,
                            nationality="Francia", birth_date=date(1998, 12, 20)),
                
                models.Player(name="Erling", surname="Haaland", number=9,
                            position=models.PlayerPosition.forward,
                            nationality="Noruega", birth_date=date(2000, 7, 21)),
                
                models.Player(name="Luka", surname="Modrić", number=10,
                            position=models.PlayerPosition.midfielder,
                            nationality="Croacia", birth_date=date(1985, 9, 9)),
                
                models.Player(name="Jude", surname="Bellingham", number=5,
                            position=models.PlayerPosition.midfielder,
                            nationality="Inglaterra", birth_date=date(2003, 6, 29)),
                
                models.Player(name="Rodri", surname="Hernández", number=16,
                            position=models.PlayerPosition.midfielder,
                            nationality="España", birth_date=date(1996, 6, 22)),
                
                models.Player(name="Antoine", surname="Griezmann", number=7,
                            position=models.PlayerPosition.forward,
                            nationality="Francia", birth_date=date(1991, 3, 21)),
                
                models.Player(name="Robert", surname="Lewandowski", number=9,
                            position=models.PlayerPosition.forward,
                            nationality="Polonia", birth_date=date(1988, 8, 21)),
                
                models.Player(name="Mohamed", surname="Salah", number=11,
                            position=models.PlayerPosition.forward,
                            nationality="Egipto", birth_date=date(1992, 6, 15)),
                
                models.Player(name="Vinícius", surname="Júnior", number=20,
                            position=models.PlayerPosition.forward,
                            nationality="Brasil", birth_date=date(2000, 7, 12)),
                
                models.Player(name="Rúben", surname="Dias", number=3,
                            position=models.PlayerPosition.defender,
                            nationality="Portugal", birth_date=date(1997, 5, 14)),
                
                models.Player(name="Achraf", surname="Hakimi", number=2,
                            position=models.PlayerPosition.defender,
                            nationality="Marruecos", birth_date=date(1998, 11, 4)),
                
                models.Player(name="Alisson", surname="Becker", number=1,
                            position=models.PlayerPosition.goalkeeper,
                            nationality="Brasil", birth_date=date(1992, 10, 2)),
                
                models.Player(name="Thibaut", surname="Courtois", number=1,
                            position=models.PlayerPosition.goalkeeper,
                            nationality="Bélgica", birth_date=date(1992, 5, 11)),
                
                models.Player(name="Pedri", surname="González", number=8,
                            position=models.PlayerPosition.midfielder,
                            nationality="España", birth_date=date(2002, 11, 25)),
            ]
            db.add_all(players)
            db.commit()
            print(f"✅ Created {len(players)} players")
        else:
            print("ℹ️ Players already exist, skipping...")

        # 3. Seed Teams
        if db.query(models.Team).count() == 0:
            players = db.query(models.Player).all()

            team1 = models.Team(
                name="Equipo A",
                category=models.TeamCategory.senior,
                coach_name="Carlos Pérez",
                leader_id=players[0].id
            )

            team2 = models.Team(
                name="Equipo B",
                category=models.TeamCategory.senior,
                coach_name="Juan Gómez",
                leader_id=players[1].id
            )

            # asignar jugadores
            team1.players = players[:3]
            team2.players = players[3:]

            db.add_all([team1, team2])
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
