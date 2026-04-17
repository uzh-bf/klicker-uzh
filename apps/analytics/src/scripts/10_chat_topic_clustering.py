# Clusters user-role ChatMessage content per chatbot using an NLP-only pipeline
# (sentence-transformers → UMAP → HDBSCAN → TF-IDF labels). No LLM involved — per §3.5,
# labels come from TF-IDF top-k terms so no raw-text leaks can happen via an LLM prompt.
# Clusters with fewer than 5 distinct participants collapse into an "Other" bucket.

import sys
from datetime import datetime
from prisma import Prisma

sys.path.append("../../")

from src.modules.chat_topic_clustering.cluster_chatbot import cluster_chatbot

COURSE_TIMESTAMP = "1970-01-01"

db = Prisma()
db.connect()

verbose = True

chatbots = db.chatbot.find_many()
print(f"Found {len(chatbots)} chatbots to cluster")

win_start = "2022-10-23T00:00:00.000Z"
win_end = datetime.now().strftime("%Y-%m-%d") + "T23:59:59.999Z"

total_rows = 0
for cb in chatbots:
    try:
        written = cluster_chatbot(
            db,
            str(cb.id),
            win_start,
            win_end,
            "COURSE",
            COURSE_TIMESTAMP,
            verbose=verbose,
        )
        total_rows += written
    except Exception as exc:
        print(f"[chat_topic_clustering] chatbot={cb.id} FAILED: {exc}")

print(f"[chat_topic_clustering] total rows written: {total_rows}")

db.disconnect()
