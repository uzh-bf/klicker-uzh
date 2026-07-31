"""Derive short, TF-IDF-based labels for each cluster (no LLM)."""

import re
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Sequence, Tuple

# Must stay in sync with the TfidfVectorizer `token_pattern` below so surface-form
# lookup tokenises identically to the vectoriser.
_TOKEN_RE = re.compile(r"(?u)\b[^\W\d_][^\W\d_]{2,}\b")


@lru_cache(maxsize=1)
def _label_stop_words() -> list[str]:
    """Combined German + English stop-word list from stopwordsiso.

    Chatbot messages are bilingual (UZH context), so both languages must be
    filtered for TF-IDF labels to surface domain terms instead of fillers.
    """
    import stopwordsiso as sw

    return sorted(sw.stopwords(["de", "en"]))


def _surface_forms(texts: Sequence[str]) -> Dict[str, str]:
    """Map each lowercased token to its most common surface form in the texts.

    Lets us show "Varianz" when participants wrote it capitalised, instead of
    the vectoriser's forced-lowercase "varianz".
    """
    counts: Dict[str, Counter] = {}
    for t in texts:
        for match in _TOKEN_RE.findall(t):
            counts.setdefault(match.lower(), Counter())[match] += 1
    return {lower: c.most_common(1)[0][0] for lower, c in counts.items()}


def _select_non_overlapping(ranked_terms: Sequence[Tuple[str, float]], k: int) -> List[str]:
    """Greedy pick up to k terms that share no tokens with already-picked ones.

    TF-IDF over a pseudo-document will happily surface both a bigram and its
    component unigrams ("variation wiederholung · variation · wiederholung"),
    which reads as redundant soup. Dropping any lower-scored candidate that
    shares a token with a kept candidate cuts that redundancy.
    """
    picked: List[str] = []
    picked_tokens: set[str] = set()
    for term, _score in ranked_terms:
        tokens = term.split()
        if any(tok in picked_tokens for tok in tokens):
            continue
        picked.append(term)
        picked_tokens.update(tokens)
        if len(picked) >= k:
            break
    return picked


def _prettify(term: str, surface: Dict[str, str]) -> str:
    return " ".join(surface.get(tok, tok) for tok in term.split())


def _top_terms_per_cluster(
    texts_per_cluster: Dict[int, List[str]],
    top_k: int = 4,
) -> Dict[int, str]:
    """Return {cluster_id: "term1 · term2 · …"} — de-duplicated TF-IDF top-k per cluster."""
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
        stop_words=_label_stop_words(),
        token_pattern=r"(?u)\b[^\W\d_][^\W\d_]{2,}\b",  # words of length >=3, no numbers
        lowercase=True,
    )
    try:
        matrix = vectorizer.fit_transform(pseudo_docs)
    except ValueError:
        # Empty vocabulary — e.g. all tokens filtered out. Return a stub label.
        return {cid: f"cluster-{cid}" for cid in cluster_ids}

    feature_names = vectorizer.get_feature_names_out()
    candidate_pool = max(top_k * 4, 16)  # enough headroom for de-dup
    labels: Dict[int, str] = {}
    for row, cid in enumerate(cluster_ids):
        row_arr = matrix.getrow(row).toarray().ravel()
        if row_arr.sum() == 0:
            labels[cid] = f"cluster-{cid}"
            continue
        top_indices = row_arr.argsort()[::-1][:candidate_pool]
        ranked = [(feature_names[i], float(row_arr[i])) for i in top_indices if row_arr[i] > 0]
        picked = _select_non_overlapping(ranked, k=top_k)
        if not picked:
            labels[cid] = f"cluster-{cid}"
            continue
        surface = _surface_forms(texts_per_cluster[cid])
        labels[cid] = " · ".join(_prettify(term, surface) for term in picked)
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
