from datetime import datetime, timedelta, timezone
import os
from types import SimpleNamespace
import unittest

from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    filter_eligible_activity,
    is_activity_eligible_for_learning_analytics,
    is_learning_analytics_rollout_enabled,
    is_participation_currently_included,
    learning_analytics_write_transaction,
)


class FakeDelegate:
    def __init__(self, result) -> None:
        self.result = result

    def find_unique(self, **_kwargs):
        return self.result


class FakeTransaction:
    def __init__(self, *, course_enabled: bool, participation_status: str = "INCLUDED") -> None:
        self.course = FakeDelegate(SimpleNamespace(isLearningAnalyticsEnabled=course_enabled))
        self.participation = FakeDelegate(
            SimpleNamespace(
                dict=lambda: {
                    "learningAnalyticsStatus": participation_status,
                    "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                    "learningAnalyticsIncludedFrom": datetime(2026, 7, 30, tzinfo=timezone.utc),
                }
            )
        )
        self.lock_queries = []

    def query_raw(self, query, *args):
        self.lock_queries.append((query, args))


class FakeTransactionManager:
    def __init__(self, transaction) -> None:
        self.transaction = transaction

    def __enter__(self):
        return self.transaction

    def __exit__(self, *_args):
        return None


class FakeDb:
    def __init__(self, transaction) -> None:
        self.transaction = transaction
        self.tx_calls = 0

    def tx(self, **_kwargs):
        self.tx_calls += 1
        return FakeTransactionManager(self.transaction)


class LearningAnalyticsEligibilityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.included_from = datetime(2026, 7, 30, 8, tzinfo=timezone.utc)
        self.participation = {
            "learningAnalyticsStatus": "INCLUDED",
            "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
            "learningAnalyticsIncludedFrom": self.included_from,
        }

    def test_rollout_gate_defaults_closed(self) -> None:
        previous = os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
        try:
            self.assertFalse(is_learning_analytics_rollout_enabled())
            os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = "true"
            self.assertTrue(is_learning_analytics_rollout_enabled())
        finally:
            if previous is None:
                os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
            else:
                os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = previous

    def test_activity_requires_every_eligibility_condition(self) -> None:
        baseline = {
            "is_course_enabled": True,
            "participation_status": "INCLUDED",
            "acknowledged_disclosure_version": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
            "included_from": self.included_from,
            "activity_at": self.included_from,
        }
        self.assertTrue(is_activity_eligible_for_learning_analytics(**baseline))

        excluded_cases = [
            {**baseline, "is_course_enabled": False},
            {**baseline, "participation_status": "UNDECIDED"},
            {**baseline, "participation_status": "EXCLUDED"},
            {**baseline, "acknowledged_disclosure_version": None},
            {**baseline, "acknowledged_disclosure_version": "outdated"},
            {**baseline, "included_from": None},
            {**baseline, "activity_at": self.included_from - timedelta(microseconds=1)},
        ]
        for case in excluded_cases:
            with self.subTest(case=case):
                self.assertFalse(is_activity_eligible_for_learning_analytics(**case))

    def test_course_reenable_uses_the_participant_boundary_only(self) -> None:
        later_activity = self.included_from + timedelta(days=1)
        self.assertTrue(
            is_activity_eligible_for_learning_analytics(
                is_course_enabled=True,
                participation_status="INCLUDED",
                acknowledged_disclosure_version=LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                included_from=self.included_from,
                activity_at=later_activity,
            )
        )

    def test_renewed_inclusion_excludes_the_previous_period(self) -> None:
        renewed_from = self.included_from + timedelta(days=2)
        self.assertFalse(
            is_activity_eligible_for_learning_analytics(
                is_course_enabled=True,
                participation_status="INCLUDED",
                acknowledged_disclosure_version=LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                included_from=renewed_from,
                activity_at=renewed_from - timedelta(microseconds=1),
            )
        )
        self.assertTrue(
            is_activity_eligible_for_learning_analytics(
                is_course_enabled=True,
                participation_status="INCLUDED",
                acknowledged_disclosure_version=LEARNING_ANALYTICS_DISCLOSURE_VERSION,
                included_from=renewed_from,
                activity_at=renewed_from,
            )
        )

    def test_current_inclusion_and_record_filtering(self) -> None:
        self.assertTrue(is_participation_currently_included(self.participation, is_course_enabled=True))
        self.assertFalse(is_participation_currently_included(self.participation, is_course_enabled=False))

        records = [
            {"id": 1, "createdAt": self.included_from - timedelta(seconds=1)},
            {"id": 2, "createdAt": self.included_from},
            {"id": 3, "createdAt": self.included_from + timedelta(seconds=1)},
        ]
        self.assertEqual(
            [
                record["id"]
                for record in filter_eligible_activity(
                    records,
                    participation=self.participation,
                    is_course_enabled=True,
                )
            ],
            [2, 3],
        )

    def test_write_transaction_fails_closed_and_uses_the_course_lock(self) -> None:
        previous = os.environ.get("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED")
        os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = "true"
        try:
            enabled_transaction = FakeTransaction(course_enabled=True)
            enabled_db = FakeDb(enabled_transaction)
            with learning_analytics_write_transaction(
                enabled_db,
                course_id="course-id",
                participant_id="participant-id",
            ) as transaction:
                self.assertIs(transaction, enabled_transaction)
            self.assertEqual(enabled_db.tx_calls, 1)
            self.assertEqual(
                enabled_transaction.lock_queries,
                [
                    (
                        "SELECT pg_advisory_xact_lock(hashtext($1))::text",
                        ("course-id",),
                    )
                ],
            )

            disabled_db = FakeDb(FakeTransaction(course_enabled=False))
            with learning_analytics_write_transaction(
                disabled_db,
                course_id="course-id",
            ) as transaction:
                self.assertIsNone(transaction)

            excluded_db = FakeDb(
                FakeTransaction(
                    course_enabled=True,
                    participation_status="EXCLUDED",
                )
            )
            with learning_analytics_write_transaction(
                excluded_db,
                course_id="course-id",
                participant_id="participant-id",
            ) as transaction:
                self.assertIsNone(transaction)
        finally:
            if previous is None:
                os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
            else:
                os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = previous

    def test_write_transaction_does_not_open_when_rollout_is_disabled(self) -> None:
        previous = os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
        db = FakeDb(FakeTransaction(course_enabled=True))
        try:
            with learning_analytics_write_transaction(
                db,
                course_id="course-id",
            ) as transaction:
                self.assertIsNone(transaction)
            self.assertEqual(db.tx_calls, 0)
        finally:
            if previous is not None:
                os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = previous


if __name__ == "__main__":
    unittest.main()
