"""Persist clustering results to ChatTopicCluster with k-anonymity enforcement."""

from typing import Dict, List

MIN_PARTICIPANTS_PER_CLUSTER = 5  # §3.9 privacy threshold

# One row per (chatbotId, timestamp, clusterIndex). We write cluster 0..N-1
# (compacted index, not HDBSCAN's raw id) plus optionally one "Other" bucket
# at index -1.

DELETE_SQL = """
DELETE FROM "ChatTopicCluster"
WHERE "chatbotId" = $1::uuid
  AND "type" = $2::"AnalyticsType"
  AND "timestamp" = $3::date
"""

INSERT_SQL = """
INSERT INTO "ChatTopicCluster" (
  "type", "timestamp", "chatbotId",
  "clusterIndex", "clusterLabel",
  "messageCount", "participantCount",
  "representativeParaphrase", "embeddingCentroid",
  "createdAt"
) VALUES (
  $1::"AnalyticsType", $2::date, $3::uuid,
  $4::int, $5::text,
  $6::int, $7::int,
  NULL, NULL,
  NOW()
)
"""


def save_clusters(
    db,
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
    # Bucket messages and participants by cluster_id (ignore -1 noise for now —
    # those get swept into "Other" below).
    message_counts: Dict[int, int] = {}
    participant_sets: Dict[int, set] = {}
    for cid, pid in zip(cluster_ids_per_message, participant_ids_per_message):
        if cid < 0:
            continue
        message_counts[cid] = message_counts.get(cid, 0) + 1
        participant_sets.setdefault(cid, set()).add(pid)

    # Build kept clusters (>= min participants) vs collapsed-to-Other.
    kept: List[tuple] = []  # list of (label, msg_count, participant_count)
    other_msg = 0
    other_participants: set = set()

    for cid, msg_count in message_counts.items():
        p_count = len(participant_sets[cid])
        if p_count < MIN_PARTICIPANTS_PER_CLUSTER:
            other_msg += msg_count
            other_participants.update(participant_sets[cid])
        else:
            kept.append((cluster_labels.get(cid, f"cluster-{cid}"), msg_count, p_count))

    # Noise messages also fold into Other.
    noise_messages = [
        (cid, pid)
        for cid, pid in zip(cluster_ids_per_message, participant_ids_per_message)
        if cid < 0
    ]
    other_msg += len(noise_messages)
    for _, pid in noise_messages:
        other_participants.add(pid)

    # Stable ordering — largest-first so clusterIndex 0 is the biggest topic.
    kept.sort(key=lambda t: t[1], reverse=True)

    # Clear prior run rows for this (chatbot, type, timestamp) to guarantee
    # idempotency without relying on a composite upsert here.
    db.execute_raw(DELETE_SQL, chatbot_id, analytics_type, timestamp)

    written = 0
    for idx, (label, msg_count, p_count) in enumerate(kept):
        db.execute_raw(
            INSERT_SQL, analytics_type, timestamp, chatbot_id,
            idx, label, msg_count, p_count,
        )
        written += 1

    # Write "Other" only if it aggregates enough participants to meet k-anonymity
    # itself — otherwise we drop it entirely to avoid a tiny-Other row.
    if len(other_participants) >= MIN_PARTICIPANTS_PER_CLUSTER:
        db.execute_raw(
            INSERT_SQL, analytics_type, timestamp, chatbot_id,
            len(kept), "Other", other_msg, len(other_participants),
        )
        written += 1

    if verbose:
        print(
            f"[chat_topic_clustering] chatbot={chatbot_id} kept={len(kept)} "
            f"other_participants={len(other_participants)} rows_written={written}"
        )
    return written
