from __future__ import annotations

import importlib
import unittest
from contextlib import AbstractContextManager
from datetime import timedelta
from types import TracebackType
from unittest import mock

import pandas as pd

from src.modules.analytics_validity.mark_analytics_valid import _render_sql
from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
    _DELETE_SQL as _DELETE_AGGREGATE_SQL,
)
from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
    _SQL_WEEKLY,
    compute_aggregated_chatbot_analytics,
)
from src.modules.chat_analytics.compute_participant_chat_analytics import (
    _DELETE_SQL as _DELETE_PARTICIPANT_SQL,
    _SQL,
    compute_participant_chat_analytics,
)

cluster_module = importlib.import_module("src.modules.chat_topic_clustering.cluster_chatbot")
responses_module = importlib.import_module("src.modules.participant_analytics.get_participant_responses")

COURSE_A = "aaaa0000-0000-0000-0000-000000000001"
COURSE_B = "aaaa0000-0000-0000-0000-000000000002"


class _ParticipantTable:
    def __init__(self) -> None:
        self.where = None
        self.include = None

    def find_many(self, *, where=None, include=None):
        self.where = where
        self.include = include
        return []


class _ParticipantDb:
    def __init__(self) -> None:
        self.participant = _ParticipantTable()


class _Transaction:
    def __init__(self) -> None:
        self.calls: list[tuple[object, ...]] = []

    def execute_raw(self, *args: object) -> int:
        self.calls.append(args)
        return 7


class _TransactionContext(AbstractContextManager[_Transaction]):
    def __init__(self, transaction: _Transaction) -> None:
        self.transaction = transaction

    def __enter__(self) -> _Transaction:
        return self.transaction

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None


class _ChatDb:
    def __init__(self) -> None:
        self.transaction = _Transaction()
        self.timeout = None

    def tx(self, *, timeout=None):
        self.timeout = timeout
        return _TransactionContext(self.transaction)


class ParticipantScopeTests(unittest.TestCase):
    def test_course_scope_is_applied_to_parent_and_nested_detail_queries(self):
        db = _ParticipantDb()

        with mock.patch.object(
            responses_module,
            "convert_to_df",
            return_value=pd.DataFrame(),
        ):
            responses_module.get_participant_responses(
                db,
                "2026-07-01T00:00:00Z",
                "2026-07-02T00:00:00Z",
                course_ids=[COURSE_A, COURSE_B],
            )

        detail_where = {
            "createdAt": {
                "gte": "2026-07-01T00:00:00Z",
                "lte": "2026-07-02T00:00:00Z",
            },
            "OR": [
                {"practiceQuiz": {"is": {"courseId": {"in": [COURSE_A, COURSE_B]}}}},
                {"microLearning": {"is": {"courseId": {"in": [COURSE_A, COURSE_B]}}}},
            ],
        }
        self.assertEqual(
            db.participant.where,
            {"detailQuestionResponses": {"some": detail_where}},
        )
        self.assertEqual(
            db.participant.include["detailQuestionResponses"]["where"],
            detail_where,
        )


class ConsentReconciliationTests(unittest.TestCase):
    def test_participant_chat_window_is_replaced_atomically(self):
        db = _ChatDb()

        rows = compute_participant_chat_analytics(
            db,
            "2026-07-01T00:00:00Z",
            "2026-07-02T00:00:00Z",
            "2026-07-01",
            "DAILY",
        )

        self.assertEqual(rows, 7)
        self.assertEqual(db.timeout, timedelta(minutes=30))
        self.assertEqual(
            db.transaction.calls,
            [
                (_DELETE_PARTICIPANT_SQL, "DAILY", "2026-07-01"),
                (
                    _SQL,
                    "2026-07-01T00:00:00Z",
                    "2026-07-02T00:00:00Z",
                    "DAILY",
                    "2026-07-01",
                ),
            ],
        )

    def test_aggregate_chat_window_is_replaced_atomically(self):
        db = _ChatDb()

        rows = compute_aggregated_chatbot_analytics(
            db,
            "2026-07-01T00:00:00Z",
            "2026-07-08T00:00:00Z",
            "2026-07-07",
            "WEEKLY",
        )

        self.assertEqual(rows, 7)
        self.assertEqual(db.timeout, timedelta(minutes=30))
        self.assertEqual(
            db.transaction.calls,
            [
                (_DELETE_AGGREGATE_SQL, "WEEKLY", "2026-07-07"),
                (
                    _SQL_WEEKLY,
                    "2026-07-01T00:00:00Z",
                    "2026-07-08T00:00:00Z",
                    "2026-07-07",
                ),
            ],
        )

    def test_below_threshold_clustering_clears_previous_rows(self):
        db = object()

        with (
            mock.patch.object(cluster_module, "load_user_text", return_value=[]),
            mock.patch.object(cluster_module, "save_clusters", return_value=0) as save,
        ):
            result = cluster_module.cluster_chatbot(
                db,
                "chatbot-a",
                "2026-07-01T00:00:00Z",
                "2026-07-02T00:00:00Z",
                "COURSE",
                "1970-01-01",
            )

        self.assertEqual(result, 0)
        save.assert_called_once_with(
            db,
            "chatbot-a",
            "COURSE",
            "1970-01-01",
            {},
            [],
            [],
            verbose=False,
        )


class AnalyticsValidityScopeTests(unittest.TestCase):
    def test_incremental_scope_filters_completion_watermarks(self):
        statement = _render_sql(False, [COURSE_A])

        self.assertIn(f"AND c.id IN ('{COURSE_A}')", statement)
        self.assertNotIn('\n  "analyticsFinalizedAt" = NOW(),', statement)

    def test_empty_incremental_scope_updates_no_course(self):
        statement = _render_sql(False, [])

        self.assertIn("AND false", statement)


if __name__ == "__main__":
    unittest.main()
