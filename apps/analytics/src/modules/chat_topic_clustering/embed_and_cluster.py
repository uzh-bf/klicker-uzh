"""Embed → UMAP → HDBSCAN clustering for user-chat text.

Model choice: intfloat/multilingual-e5-base — multilingual (KlickerUZH courses
mix DE/EN) and small enough for CPU (~450MB). Anyone wanting a smaller footprint
can swap MODEL_NAME without touching the rest of the pipeline.
"""

from typing import List, Sequence

import numpy as np

MODEL_NAME = "intfloat/multilingual-e5-base"
MIN_CLUSTER_SIZE = 8
UMAP_COMPONENTS = 5
UMAP_NEIGHBORS = 15

# Minimum input size before we even attempt clustering. Below this HDBSCAN is
# noisy (nearly everything becomes noise or one giant blob), so we skip.
MIN_MESSAGES = 30

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_texts(texts: Sequence[str]) -> np.ndarray:
    # e5 models expect a "query: " or "passage: " prefix. For short chat questions
    # "query: " matches the ask-a-question retrieval flavor.
    prefixed = [f"query: {t}" for t in texts]
    model = _get_model()
    return np.asarray(
        model.encode(prefixed, show_progress_bar=False, normalize_embeddings=True)
    )


def cluster_embeddings(embeddings: np.ndarray) -> List[int]:
    """Return cluster label per input row. -1 = noise (HDBSCAN convention)."""
    import umap
    import hdbscan

    n = len(embeddings)
    n_neighbors = min(UMAP_NEIGHBORS, max(2, n - 1))
    reducer = umap.UMAP(
        n_components=UMAP_COMPONENTS,
        n_neighbors=n_neighbors,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    reduced = reducer.fit_transform(embeddings)
    # Decouple min_samples from min_cluster_size. When min_samples is left at its
    # default it equals min_cluster_size (8 here), which makes mutual-reachability
    # distances over-aggressive on homogeneous corpora (a single university
    # course's tutoring chat, for example) and collapses sub-topics into one mega
    # cluster with a long noise tail. BERTopic-style pipelines conventionally use
    # min_samples in the 1..3 range; 2 is the sweet spot for this corpus — it
    # recruits ~half of the ms=3 noise tail into existing clusters (verified on
    # the MAT183 dry run: noise 63 → 33) without fragmenting into weakly coherent
    # meta-clusters the way ms=1 does.
    #
    # cluster_selection_method="leaf" (vs. the default "eom") picks leaf clusters
    # of the condensed tree instead of the most-massive branch. On topically
    # homogeneous corpora EOM reliably collapses sub-topics into one mega cluster
    # (verified against the same MAT183 run: EOM + min_samples=3 produced 222/232
    # messages in a single cluster). "leaf" preserves the finer sub-structure,
    # which is what we actually want here.
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=MIN_CLUSTER_SIZE,
        min_samples=2,
        metric="euclidean",
        cluster_selection_method="leaf",
    )
    return clusterer.fit_predict(reduced).tolist()
