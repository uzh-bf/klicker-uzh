# Clusters user-role ChatMessage content per chatbot using an NLP-only pipeline
# (sentence-transformers → UMAP → HDBSCAN → TF-IDF labels). No LLM involved — per §3.5,
# labels come from TF-IDF top-k terms so no raw-text leaks can happen via an LLM prompt.
# Clusters with fewer than 5 distinct participants collapse into an "Other" bucket.

import sys
from datetime import datetime

from sqlalchemy import select

sys.path.append("../../")

from src.db import SessionLocal
from src.models import Chatbot
from src.modules.chat_topic_clustering.cluster_chatbot import cluster_chatbot
from src.modules.utils import scoped_course_ids

COURSE_TIMESTAMP = "1970-01-01"


def main() -> None:
    verbose = True

    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        if scope is not None:
            if not scope:
                print(
                    "[10_chat_topic_clustering] empty course scope — nothing to cluster"
                )
                chatbots = []
            else:
                chatbots = (
                    session.execute(select(Chatbot).where(Chatbot.courseId.in_(scope)))
                    .scalars()
                    .all()
                )
        else:
            chatbots = session.execute(select(Chatbot)).scalars().all()

        scope_note = (
            f" (scoped to {len(scope)} course ids)" if scope is not None else ""
        )
        print(f"Found {len(chatbots)} chatbots to cluster{scope_note}")

        win_start = "2022-10-23T00:00:00.000Z"
        win_end = datetime.now().strftime("%Y-%m-%d") + "T23:59:59.999Z"

        total_rows = 0
        for cb in chatbots:
            try:
                written = cluster_chatbot(
                    session,
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


if __name__ == "__main__":
    main()
