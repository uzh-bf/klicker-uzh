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
    return np.asarray(model.encode(prefixed, show_progress_bar=False, normalize_embeddings=True))


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
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=MIN_CLUSTER_SIZE,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    return clusterer.fit_predict(reduced).tolist()
