"""Top-level orchestrator for clustering a single chatbot."""

from collections import Counter

from sqlalchemy.orm import Session

from .derive_cluster_labels import derive_labels
from .embed_and_cluster import MIN_MESSAGES, cluster_embeddings, embed_texts
from .load_user_text import load_user_text
from .save_topic_clusters import save_clusters


def cluster_chatbot(
    session: Session,
    chatbot_id: str,
    win_start: str,
    win_end: str,
    analytics_type: str,
    timestamp: str,
    verbose: bool = False,
) -> int:
    """Run the full clustering pipeline for one chatbot and persist results.

    Returns number of ChatTopicCluster rows written (0 if skipped due to too-few
    messages).
    """
    rows = load_user_text(session, chatbot_id, win_start, win_end)
    if verbose:
        print(f"[chat_topic_clustering] chatbot={chatbot_id} messages_loaded={len(rows)}")

    if len(rows) < MIN_MESSAGES:
        if verbose:
            print(
                f"[chat_topic_clustering] chatbot={chatbot_id} skipped — needs >= "
                f"{MIN_MESSAGES} messages, got {len(rows)}"
            )
        return save_clusters(
            db,
            chatbot_id,
            analytics_type,
            timestamp,
            {},
            [],
            [],
            verbose=verbose,
        )

    texts = [r["text"] for r in rows]
    participant_ids = [str(r["participant_id"]) for r in rows]

    embeddings = embed_texts(texts)
    cluster_ids = cluster_embeddings(embeddings)
    if verbose:
        counts = Counter(cid for cid in cluster_ids if cid >= 0)
        noise_count = sum(1 for cid in cluster_ids if cid < 0)
        sizes_desc = sorted(counts.values(), reverse=True)
        print(
            f"[chat_topic_clustering] chatbot={chatbot_id} raw_clusters="
            f"{len(counts)} raw_sizes={sizes_desc} noise={noise_count}"
        )
    labels = derive_labels(cluster_ids, texts)

    return save_clusters(
        session,
        chatbot_id,
        analytics_type,
        timestamp,
        labels,
        cluster_ids,
        participant_ids,
        verbose=verbose,
    )
