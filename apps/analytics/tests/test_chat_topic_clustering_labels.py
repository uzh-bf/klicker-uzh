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


def test_derive_labels_filters_additional_german_fillers_from_prod_run():
    from src.modules.chat_topic_clustering.derive_cluster_labels import derive_labels

    labels = derive_labels(
        [0, 0, 0, 1, 1, 1],
        [
            "sigma kann auf dieser uhr berechnet werden sigma",
            "ich weiß nicht wie sigma auf dieser uhr berechnet wird",
            "auf der uhr sigma berechnung kann ich sigma",
            "normal distribution example variance",
            "variance formula example normal distribution",
            "example example variance standard deviation",
        ],
    )

    label = labels[0]
    assert "sigma" in label
    for filler in ("uhr", "auf", "kann", "wird", "werden", "nicht", "wie", "ich"):
        assert filler not in label.split(" · "), (
            f"expected '{filler}' to be filtered, got label: {label}"
        )
