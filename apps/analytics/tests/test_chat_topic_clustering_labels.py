from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_derive_labels_filters_common_bilingual_filler_terms():
    from src.modules.chat_topic_clustering.derive_cluster_labels import derive_labels

    labels = derive_labels(
        [0, 0, 1, 1],
        [
            "ich the project fairness question",
            "the und fairness project grading",
            "feedback rubric explanation",
            "rubric feedback consistency",
        ],
    )

    label = labels[0]
    assert "project" in label
    assert "fairness" in label
    assert "the" not in label
    assert "ich" not in label
