"""Derive short, TF-IDF-based labels for each cluster (no LLM)."""

from typing import Dict, List, Sequence


def _top_terms_per_cluster(
    texts_per_cluster: Dict[int, List[str]],
    top_k: int = 4,
) -> Dict[int, str]:
    """Return {cluster_id: "term1 · term2 · …"} — TF-IDF top-k per cluster."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    if not texts_per_cluster:
        return {}

    cluster_ids = list(texts_per_cluster.keys())
    # One pseudo-document per cluster = concatenated member messages.
    pseudo_docs = [" ".join(texts_per_cluster[cid]) for cid in cluster_ids]
    vectorizer = TfidfVectorizer(
        max_df=0.9,
        min_df=1,
        ngram_range=(1, 2),
        stop_words=None,  # keep simple — multilingual; fall back to df-based filtering
        token_pattern=r"(?u)\b[^\W\d_][^\W\d_]{2,}\b",  # words of length >=3, no numbers
        lowercase=True,
    )
    try:
        matrix = vectorizer.fit_transform(pseudo_docs)
    except ValueError:
        # Empty vocabulary — e.g. all tokens filtered out. Return a stub label.
        return {cid: f"cluster-{cid}" for cid in cluster_ids}

    feature_names = vectorizer.get_feature_names_out()
    labels: Dict[int, str] = {}
    for row, cid in enumerate(cluster_ids):
        row_arr = matrix.getrow(row).toarray().ravel()
        if row_arr.sum() == 0:
            labels[cid] = f"cluster-{cid}"
            continue
        top_indices = row_arr.argsort()[::-1][:top_k]
        top_tokens = [feature_names[i] for i in top_indices if row_arr[i] > 0]
        labels[cid] = " · ".join(top_tokens) if top_tokens else f"cluster-{cid}"
    return labels


def derive_labels(cluster_ids: Sequence[int], texts: Sequence[str]) -> Dict[int, str]:
    """Aggregate member texts per cluster and return TF-IDF label per cluster.

    Noise (cluster_id = -1) is excluded — it becomes the "Other" bucket at save time
    and doesn't need a label.
    """
    assert len(cluster_ids) == len(texts)
    buckets: Dict[int, List[str]] = {}
    for cid, text in zip(cluster_ids, texts):
        if cid < 0:
            continue
        buckets.setdefault(cid, []).append(text)
    return _top_terms_per_cluster(buckets)
