"""Persist clustering results to ChatTopicCluster with k-anonymity enforcement."""

from typing import Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session

MIN_PARTICIPANTS_PER_CLUSTER = 3  # §3.9 privacy threshold

DELETE_SQL = """
DELETE FROM "ChatTopicCluster"
WHERE "chatbotId" = CAST(:chatbot_id AS uuid)
  AND "type" = CAST(:analytics_type AS "AnalyticsType")
  AND "timestamp" = CAST(:ts AS date)
"""

INSERT_SQL = """
INSERT INTO "ChatTopicCluster" (
  "type", "timestamp", "chatbotId",
  "clusterIndex", "clusterLabel",
  "messageCount", "participantCount",
  "representativeParaphrase", "embeddingCentroid",
  "createdAt"
) VALUES (
  CAST(:analytics_type AS "AnalyticsType"), CAST(:ts AS date), CAST(:chatbot_id AS uuid),
  CAST(:cluster_index AS int), CAST(:cluster_label AS text),
  CAST(:message_count AS int), CAST(:participant_count AS int),
  NULL, NULL,
  NOW()
)
"""


def save_clusters(
    session: Session,
    chatbot_id: str,
    analytics_type: str,
    timestamp: str,
    cluster_labels: Dict[int, str],
    cluster_ids_per_message: List[int],
    participant_ids_per_message: List[str],
    verbose: bool = False,
) -> int:
    """Group clustering output, apply k-anonymity, delete old rows, insert new.

    Returns the number of rows written (including an "Other" bucket if any small
    clusters were collapsed into it).
    """
    message_counts: Dict[int, int] = {}
    participant_sets: Dict[int, set] = {}
    for cid, pid in zip(cluster_ids_per_message, participant_ids_per_message):
        if cid < 0:
            continue
        message_counts[cid] = message_counts.get(cid, 0) + 1
        participant_sets.setdefault(cid, set()).add(pid)

    kept: List[tuple] = []
    other_msg = 0
    other_participants: set = set()
    dropped_by_kanon: List[tuple] = []  # (msg_count, participant_count) per collapsed cluster

    for cid, msg_count in message_counts.items():
        p_count = len(participant_sets[cid])
        if p_count < MIN_PARTICIPANTS_PER_CLUSTER:
            other_msg += msg_count
            other_participants.update(participant_sets[cid])
            dropped_by_kanon.append((msg_count, p_count))
        else:
            kept.append((cluster_labels.get(cid, f"cluster-{cid}"), msg_count, p_count))

    noise_messages = [
        (cid, pid)
        for cid, pid in zip(cluster_ids_per_message, participant_ids_per_message)
        if cid < 0
    ]
    other_msg += len(noise_messages)
    for _, pid in noise_messages:
        other_participants.add(pid)

    kept.sort(key=lambda t: t[1], reverse=True)

    session.execute(
        text(DELETE_SQL),
        {"chatbot_id": chatbot_id, "analytics_type": analytics_type, "ts": timestamp},
    )

    written = 0
    for idx, (label, msg_count, p_count) in enumerate(kept):
        session.execute(
            text(INSERT_SQL),
            {
                "analytics_type": analytics_type,
                "ts": timestamp,
                "chatbot_id": chatbot_id,
                "cluster_index": idx,
                "cluster_label": label,
                "message_count": msg_count,
                "participant_count": p_count,
            },
        )
        written += 1

    if len(other_participants) >= MIN_PARTICIPANTS_PER_CLUSTER:
        session.execute(
            text(INSERT_SQL),
            {
                "analytics_type": analytics_type,
                "ts": timestamp,
                "chatbot_id": chatbot_id,
                "cluster_index": len(kept),
                "cluster_label": "Other",
                "message_count": other_msg,
                "participant_count": len(other_participants),
            },
        )
        written += 1

    session.commit()

    if verbose:
        dropped_sorted = sorted(dropped_by_kanon, key=lambda t: t[0], reverse=True)
        dropped_msgs = sum(m for m, _ in dropped_sorted)
        print(
            f"[chat_topic_clustering] chatbot={chatbot_id} kept={len(kept)} "
            f"other_participants={len(other_participants)} rows_written={written} "
            f"dropped_by_kanon={dropped_sorted} dropped_msgs={dropped_msgs} "
            f"noise_msgs={len(noise_messages)}"
        )
    return written
