#!/usr/bin/env python3
"""
Genera un hash bcrypt da inserire in users.json.

Uso:
    python scripts/hash_password.py MyPassword123!

Output:
    $2b$12$<hash>   ← copia questo valore nel campo hashed_password
"""
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    try:
        import bcrypt
    except ImportError:
        print("Errore: installa bcrypt con 'pip install bcrypt'")
        sys.exit(1)

    password = sys.argv[1]
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    print(hashed)


if __name__ == "__main__":
    main()
