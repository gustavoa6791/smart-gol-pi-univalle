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
                models.Player(
                    name="Lionel",
                    surname="Messi",
                    number=10,
                    position=models.PlayerPosition.forward,
                    nationality="Argentino",
                    birth_date=date(1987, 6, 24),
                    notes="El mejor de la historia"
                ),
                models.Player(
                    name="Cristiano",
                    surname="Ronaldo",
                    number=7,
                    position=models.PlayerPosition.forward,
                    nationality="Portugués",
                    birth_date=date(1985, 2, 5),
                    notes="Siuuuuu"
                ),
                models.Player(
                    name="Emiliano",
                    surname="Martínez",
                    number=23,
                    position=models.PlayerPosition.goalkeeper,
                    nationality="Argentino",
                    birth_date=date(1992, 9, 2),
                    notes="Dibu"
                )
            ]
            db.add_all(players)
            db.commit()
            print(f"✅ Created {len(players)} players")
        else:
            print("ℹ️ Players already exist, skipping...")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
