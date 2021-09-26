import os
import redisdl
import json
from dotenv import load_dotenv

load_dotenv()

with open("dump.json", "r") as f:
    data = f.read().replace("\n", "")

    redisdl.loads(
        data,
        host=os.getenv("REDIS_TARGET_HOSTNAME", "localhost"),
        port=os.getenv("REDIS_TARGET_PORT", 6380),
        password=os.getenv("REDIS_TARGET_PASSWORD"),
        ssl=True
        # db=os.getenv("REDIS_TARGET_DB", 0),
    )
