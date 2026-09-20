from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace

import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from modules import analytics_eligibility as eligibility_module
from modules.activity_progress.save_microlearning_progress import (
    save_microlearning_progress,
)
from modules.activity_progress.save_practice_quiz_progress import (
    save_practice_quiz_progress,
)
from modules.aggregated_analytics.save_aggregated_analytics import (
    save_aggregated_analytics,
)
from modules.instance_activity_performance.save_activity_performance import (
    save_activity_performance,
)
from modules.instance_activity_performance.save_instance_performances import (
    save_instance_performances,
)
from modules.participant_activity_performance.save_participant_activity_performance import (
    save_participant_activity_performance,
)
from modules.participant_analytics.save_participant_analytics import (
    save_participant_analytics,
)
from modules.participant_course_analytics.save_participant_course_analytics import (
    save_participant_course_analytics,
)
from modules.participant_performance.save_participant_performance import (
    save_participant_performance,
)


PARTICIPANT_ID = "00000000-0000-0000-0000-000000000001"
COURSE_ID = "course-1"
CHOICE_AT = datetime(2026, 9, 1, tzinfo=timezone.utc)


class _ValidationModel:
    def __init__(self, row):
        self.row = row

    def find_unique(self, *, where):
        return self.row

    def find_unique_or_raise(self, *, where, include):
        raise AssertionError("course writer was reached")


class _WriterThatMustNotBeReached:
    def __init__(self, attempts):
        self.attempts = attempts

    def upsert(self, **kwargs):
        self.attempts.append("upsert")
        raise AssertionError("analytics writer was reached")


class _Transaction:
    def __init__(self, generation, course_enabled, validation_rows, attempts):
        self.analyticseligibilitygeneration = _ValidationModel({"generation": generation})
        self.course = _ValidationModel({"isLearningAnalyticsEnabled": course_enabled})
        self.validation_rows = validation_rows
        self.events = []

        for model_name in (
            "activityprogress",
            "participantanalytics",
            "participantcourseanalytics",
            "participantperformance",
            "participantactivityperformance",
            "aggregatedanalytics",
            "instanceperformance",
            "activityperformance",
        ):
            setattr(self, model_name, _WriterThatMustNotBeReached(attempts))

    def execute_raw(self, query, *parameters):
        self.events.append(("lock", query, parameters))

    def query_raw(self, query, *parameters):
        self.events.append(("validate", query, parameters))
        return self.validation_rows


class _TransactionContext:
    def __init__(self, transaction):
        self.transaction = transaction

    def __enter__(self):
        return self.transaction

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class _Database:
    def __init__(self, generation=0, course_enabled=True, validation_rows=None):
        self.generation = generation
        self.course_enabled = course_enabled
        self.validation_rows = validation_rows or []
        self.transactions = []
        self.write_attempts = []

    def tx(self, *, max_wait, timeout):
        transaction = _Transaction(
            self.generation,
            self.course_enabled,
            self.validation_rows,
            self.write_attempts,
        )
        self.transactions.append((max_wait, timeout, transaction))
        return _TransactionContext(transaction)


def _eligibility():
    return eligibility_module.AnalyticsEligibilityContext(
        generation=0,
        disclosure_version="v1",
        participants=(eligibility_module.EligibleParticipant(PARTICIPANT_ID, CHOICE_AT),),
    )


def _validation_rows(choice_at=CHOICE_AT):
    return [{"participantId": PARTICIPANT_ID, "choiceAt": choice_at}]


def _participant_analytics_frame():
    return pd.DataFrame(
        [
            {
                "courseId": COURSE_ID,
                "participantId": PARTICIPANT_ID,
                "trialsCount": 1,
                "responseCount": 1,
                "totalScore": 1.0,
                "totalPoints": 1.0,
                "totalXp": 1.0,
                "meanCorrectCount": 1.0,
                "meanPartialCount": 0.0,
                "meanWrongCount": 0.0,
                "firstCorrectCount": 1,
                "firstWrongCount": 0,
                "lastCorrectCount": 1,
                "lastWrongCount": 0,
            }
        ]
    )


def _participant_course_analytics_frame():
    return pd.DataFrame(
        [
            {
                "courseId": COURSE_ID,
                "participantId": PARTICIPANT_ID,
                "activeWeeks": 1,
                "activeDaysPerWeek": 1.0,
                "meanElementsPerDay": 1.0,
                "activityLevel": 1.0,
            }
        ]
    )


def _participant_performance_frame():
    return pd.DataFrame(
        [
            {
                "participantId": PARTICIPANT_ID,
                "firstErrorRate": 0.0,
                "firstPerformance": 1.0,
                "lastErrorRate": 0.0,
                "lastPerformance": 1.0,
                "totalErrorRate": 0.0,
                "totalPerformance": 1.0,
            }
        ]
    )


def _participant_activity_performance_frame():
    return pd.DataFrame(
        [
            {
                "participantId": PARTICIPANT_ID,
                "activityId": "microlearning-1",
                "totalScore": 1.0,
                "completion": 1.0,
            }
        ]
    )


def _aggregated_analytics_frame():
    return pd.DataFrame(
        [
            {
                "courseId": COURSE_ID,
                "participantCount": 1,
                "responseCount": 1,
                "totalScore": 1.0,
                "totalPoints": 1.0,
                "totalXp": 1.0,
            }
        ]
    )


def _instance_performance_frame():
    return pd.DataFrame(
        [
            {
                "instanceId": "instance-1",
                "responseCount": 1,
                "totalErrorRate": 0.0,
                "totalPartialRate": 0.0,
                "totalCorrectRate": 1.0,
                "averageTimeSpent": 1.0,
            }
        ]
    )


def _activity_performance():
    return SimpleNamespace(
        totalErrorRate=0.0,
        totalPartialRate=0.0,
        totalCorrectRate=1.0,
    )


def _writer_calls(db, eligibility):
    return [
        (
            "microlearning progress",
            lambda: save_microlearning_progress(
                db,
                1,
                1,
                1,
                COURSE_ID,
                "microlearning-1",
                eligibility=eligibility,
            ),
        ),
        (
            "practice quiz progress",
            lambda: save_practice_quiz_progress(
                db,
                1,
                1,
                1,
                1,
                COURSE_ID,
                "practice-quiz-1",
                eligibility=eligibility,
            ),
        ),
        (
            "participant analytics",
            lambda: save_participant_analytics(
                db,
                _participant_analytics_frame(),
                "2026-09-01T00:00:00.000Z",
                eligibility=eligibility,
            ),
        ),
        (
            "participant course analytics",
            lambda: save_participant_course_analytics(
                db,
                _participant_course_analytics_frame(),
                eligibility=eligibility,
            ),
        ),
        (
            "participant performance",
            lambda: save_participant_performance(
                db,
                _participant_performance_frame(),
                COURSE_ID,
                eligibility=eligibility,
            ),
        ),
        (
            "participant activity performance",
            lambda: save_participant_activity_performance(
                db,
                _participant_activity_performance_frame(),
                "microLearnings",
                course_id=COURSE_ID,
                eligibility=eligibility,
            ),
        ),
        (
            "aggregated analytics",
            lambda: save_aggregated_analytics(
                db,
                _aggregated_analytics_frame(),
                "2026-09-01T00:00:00.000Z",
                eligibility=eligibility,
            ),
        ),
        (
            "instance performance",
            lambda: save_instance_performances(
                db,
                _instance_performance_frame(),
                COURSE_ID,
                total_only=True,
                eligibility=eligibility,
            ),
        ),
        (
            "activity performance",
            lambda: save_activity_performance(
                db,
                _activity_performance(),
                COURSE_ID,
                microlearning_id="microlearning-1",
                eligibility=eligibility,
            ),
        ),
    ]


class PublicationFencingTests(unittest.TestCase):
    def test_each_writer_rejects_stale_generation_before_any_write(self):
        for name, _ in _writer_calls(
            _Database(
                generation=1,
                validation_rows=_validation_rows(),
            ),
            _eligibility(),
        ):
            with self.subTest(writer=name):
                database = _Database(
                    generation=1,
                    validation_rows=_validation_rows(),
                )
                invoke = dict(_writer_calls(database, _eligibility()))[name]

                with self.assertRaises(eligibility_module.AnalyticsEligibilityChanged):
                    invoke()

                self.assertEqual(database.write_attempts, [])

    def test_each_writer_rejects_denied_course_before_any_write(self):
        for name, _ in _writer_calls(_Database(), _eligibility()):
            with self.subTest(writer=name):
                database = _Database(
                    course_enabled=False,
                    validation_rows=_validation_rows(),
                )
                invoke = dict(_writer_calls(database, _eligibility()))[name]

                with self.assertRaises(eligibility_module.AnalyticsEligibilityChanged):
                    invoke()

                self.assertEqual(database.write_attempts, [])

    def test_each_writer_rejects_changed_or_pending_participant_before_any_write(self):
        participant_states = (
            ("choice changed", _validation_rows(CHOICE_AT + timedelta(seconds=1))),
            ("pending withdrawal", []),
        )

        for state, validation_rows in participant_states:
            for name, _ in _writer_calls(_Database(), _eligibility()):
                with self.subTest(state=state, writer=name):
                    database = _Database(validation_rows=validation_rows)
                    invoke = dict(_writer_calls(database, _eligibility()))[name]

                    with self.assertRaises(eligibility_module.AnalyticsEligibilityChanged):
                        invoke()

                    self.assertEqual(database.write_attempts, [])

    def test_each_writer_requires_an_explicit_eligibility_context(self):
        for name, _ in _writer_calls(_Database(), None):
            with self.subTest(writer=name):
                database = _Database()
                invoke = dict(_writer_calls(database, None))[name]

                with self.assertRaises(eligibility_module.AnalyticsEligibilityRequired):
                    invoke()

                self.assertEqual(database.transactions, [])
                self.assertEqual(database.write_attempts, [])


if __name__ == "__main__":
    unittest.main()
