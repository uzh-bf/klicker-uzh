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

with open("dump.json") as f:
    redisdl.load(
        f,
        host=os.getenv("REDIS_TARGET_HOSTNAME", "localhost"),
        port=os.getenv("REDIS_TARGET_PORT", 6380),
        password=os.getenv("REDIS_TARGET_PASSWORD"),
        db=os.getenv("REDIS_TARGET_DB", 0),
    )
