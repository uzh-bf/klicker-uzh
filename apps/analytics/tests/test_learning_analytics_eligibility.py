from datetime import datetime, timedelta, timezone
import os
import unittest
from unittest.mock import MagicMock, patch

from src.modules.learning_analytics_eligibility import (
    LEARNING_ANALYTICS_DISCLOSURE_VERSION,
    eligible_course_ids,
    filter_eligible_activity,
    filter_learning_analytics_rows_for_write,
    is_activity_eligible_for_learning_analytics,
    is_learning_analytics_rollout_enabled,
    is_participation_currently_included,
    lock_learning_analytics_courses,
)


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

    def test_course_scope_defaults_closed_and_intersects_requested_ids(self) -> None:
        previous = os.environ.get("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED")
        session = MagicMock()
        session.execute.return_value.scalars.return_value.all.return_value = ["enabled-course"]
        try:
            os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
            self.assertEqual(eligible_course_ids(session, ["enabled-course"]), [])
            session.execute.assert_not_called()

            os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = "true"
            self.assertEqual(
                eligible_course_ids(session, ["enabled-course", "disabled-course"]),
                ["enabled-course"],
            )
            session.execute.assert_called_once()
        finally:
            if previous is None:
                os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
            else:
                os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = previous

    @patch(
        "src.modules.learning_analytics_eligibility.eligible_course_ids",
        return_value=["course-a"],
    )
    def test_write_lock_is_sorted_and_course_rows_are_rechecked(
        self,
        _eligible_course_ids,
    ) -> None:
        previous = os.environ.get("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED")
        os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = "true"
        session = MagicMock()
        try:
            self.assertEqual(
                lock_learning_analytics_courses(
                    session,
                    ["course-b", "course-a", "course-b"],
                ),
                {"course-a"},
            )
            self.assertEqual(
                [call.args[0].text for call in session.execute.call_args_list],
                [
                    "SELECT pg_advisory_xact_lock(hashtext(:course_id))::text",
                    "SELECT pg_advisory_xact_lock(hashtext(:course_id))::text",
                ],
            )
            self.assertEqual(
                [call.args[1] for call in session.execute.call_args_list],
                [{"course_id": "course-a"}, {"course_id": "course-b"}],
            )
        finally:
            if previous is None:
                os.environ.pop("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED", None)
            else:
                os.environ["NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED"] = previous

    @patch(
        "src.modules.learning_analytics_eligibility.lock_learning_analytics_courses",
        return_value={"course-a"},
    )
    def test_course_level_write_rows_fail_closed_after_lock(self, _lock) -> None:
        rows = [
            {"courseId": "course-a", "value": 1},
            {"courseId": "course-b", "value": 2},
        ]
        self.assertEqual(
            filter_learning_analytics_rows_for_write(MagicMock(), rows),
            [{"courseId": "course-a", "value": 1}],
        )


if __name__ == "__main__":
    unittest.main()
