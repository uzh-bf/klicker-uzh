"""Regression guard on HDBSCAN parameters used for chat-topic clustering.

Feeds three well-separated synthetic topic centroids through `cluster_embeddings`
and asserts that the clusterer recovers more than one non-noise cluster. This
catches future changes (e.g. resetting `min_samples` back to its default) that
silently regress the pipeline to a single-mega-cluster regime.
"""

from __future__ import annotations

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _three_centroid_embeddings(
    points_per_centroid: int = 30,
    dim: int = 32,
    noise_scale: float = 0.02,
    seed: int = 0,
) -> np.ndarray:
    """Build `3 * points_per_centroid` unit-normalized embeddings on 3 centroids."""
    rng = np.random.default_rng(seed)
    centroids = np.zeros((3, dim))
    centroids[0, 0] = 1.0
    centroids[1, 1] = 1.0
    centroids[2, 2] = 1.0

    rows = []
    for c in centroids:
        noise = rng.normal(0.0, noise_scale, size=(points_per_centroid, dim))
        rows.append(c + noise)
    embeddings = np.vstack(rows)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / norms


def test_cluster_embeddings_recovers_multiple_clusters_on_separated_topics():
    pytest.importorskip("hdbscan")
    pytest.importorskip("umap")

    from src.modules.chat_topic_clustering.embed_and_cluster import cluster_embeddings

    embeddings = _three_centroid_embeddings()
    cluster_ids = cluster_embeddings(embeddings)

    assert len(cluster_ids) == len(embeddings)

    non_noise = [cid for cid in cluster_ids if cid >= 0]
    distinct = set(non_noise)

    assert len(distinct) >= 2, (
        f"expected >= 2 non-noise clusters, got {len(distinct)}: "
        f"{sorted(distinct)} (noise={len(cluster_ids) - len(non_noise)})"
    )

    noise_fraction = (len(cluster_ids) - len(non_noise)) / len(cluster_ids)
    assert noise_fraction < 0.5, (
        f"noise fraction {noise_fraction:.2f} too high — clustering is degenerate"
    )
