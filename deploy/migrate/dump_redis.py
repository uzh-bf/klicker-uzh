import os
import redisdl
from dotenv import load_dotenv

load_dotenv()

with open("dump.json", "w") as f:
    redisdl.dump(
        f,
        host=os.getenv("REDIS_SOURCE_HOSTNAME", "localhost"),
        port=os.getenv("REDIS_SOURCE_PORT", 6379),
        password=os.getenv("REDIS_SOURCE_PASSWORD", "localhost"),
        db=os.getenv("REDIS_SOURCE_DB", 3),
    )
