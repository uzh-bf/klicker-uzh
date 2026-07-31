from sqlalchemy import select

from src.db import SessionLocal
from src.models import User


def main() -> None:
    with SessionLocal() as session:
        user = session.execute(select(User).limit(1)).scalar_one_or_none()
        print(user)


if __name__ == "__main__":
    main()
