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


def test_derive_labels_deduplicates_overlapping_ngrams():
    from src.modules.chat_topic_clustering.derive_cluster_labels import derive_labels

    # Bigram "variation wiederholung" fully overlaps with the unigrams
    # "variation" and "wiederholung" — the label should not emit both.
    labels = derive_labels(
        [0] * 6 + [1] * 4,
        [
            "variation wiederholung treffer",
            "variation wiederholung variation",
            "wiederholung variation treffer",
            "variation wiederholung kombination",
            "treffer variation wiederholung",
            "wiederholung variation kombination",
            "other topic alpha beta",
            "alpha beta gamma delta",
            "beta gamma delta epsilon",
            "alpha gamma epsilon delta",
        ],
    )

    parts = labels[0].split(" · ")
    assert len(parts) == len(set(parts)), f"duplicate label parts: {labels[0]}"
    # No emitted phrase should be fully contained in another emitted phrase.
    tokenised = [set(p.lower().split()) for p in parts]
    for i, a in enumerate(tokenised):
        for j, b in enumerate(tokenised):
            if i == j:
                continue
            assert not a.issubset(b), (
                f"'{parts[i]}' is redundantly contained in '{parts[j]}' "
                f"within label: {labels[0]}"
            )


def test_derive_labels_restores_original_surface_casing():
    from src.modules.chat_topic_clustering.derive_cluster_labels import derive_labels

    # German nouns should surface capitalised when participants wrote them that
    # way — chat messages are lower-cased inside the vectoriser, but the final
    # label should reflect the most common surface form.
    labels = derive_labels(
        [0] * 4 + [1] * 4,
        [
            "Varianz und Formel für Zufallsvariable",
            "Varianz Formel Zufallsvariable",
            "die Varianz Formel bestimmt die Zufallsvariable",
            "Formel Varianz Zufallsvariable",
            "Queue Warteschlange Migros Kasse",
            "Migros Warteschlange Ereignisse Kasse",
            "Kasse Migros Warteschlange Ereignisse",
            "Ereignisse Migros Warteschlange Queue",
        ],
    )

    assert "Varianz" in labels[0], labels[0]
    assert "Formel" in labels[0], labels[0]
