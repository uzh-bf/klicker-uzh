from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace

import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from modules import analytics_eligibility as eligibility_module
from modules.activity_progress.save_practice_quiz_progress import (
    save_practice_quiz_progress,
)
from modules.aggregated_analytics.save_aggregated_analytics import (
    save_aggregated_analytics,
)
from modules.participant_analytics.save_participant_analytics import (
    save_participant_analytics,
)


PARTICIPANT_ID = "00000000-0000-0000-0000-000000000001"
COURSE_ID = "course-1"
CHOICE_AT = datetime(2026, 9, 1, tzinfo=timezone.utc)


def _row(**overrides):
    row = {
        "courseId": COURSE_ID,
        "participantId": PARTICIPANT_ID,
        "trialsCount": 4,
        "responseCount": 3,
        "totalScore": 10,
        "totalPoints": 12,
        "totalXp": 9,
        "meanCorrectCount": 1.0,
        "meanPartialCount": 0.5,
        "meanWrongCount": 1.5,
        "firstCorrectCount": 1.0,
        "firstWrongCount": 2.0,
        "lastCorrectCount": 2.0,
        "lastWrongCount": 1.0,
    }
    row.update(overrides)
    return row


class _ParticipantAnalyticsModel:
    def __init__(self):
        self.store = {}
        self.next_id = 1

    def _key(self, where):
        scope = where["type_courseId_participantId_timestamp"]
        return (
            scope["type"],
            scope["courseId"],
            scope["participantId"],
            scope["timestamp"],
        )

    def find_unique(self, *, where):
        return self.store.get(self._key(where))

    def upsert(self, *, where, data):
        key = self._key(where)
        if key not in self.store:
            self.store[key] = SimpleNamespace(id=self.next_id)
            self.next_id += 1
        return self.store[key]


class _ContributionModel:
    def __init__(self):
        self.deletions = []
        self.creates = []

    def delete_many(self, *, where):
        self.deletions.append(where)
        return len(self.deletions)

    def create(self, data):
        self.creates.append(data)
        return SimpleNamespace(id=len(self.creates))


class _AggregateModel:
    def __init__(self):
        self.store = {}
        self.next_id = 1

    def find_unique(self, *, where):
        scope = where["type_courseId_timestamp"]
        return self.store.get(
            (scope["type"], scope["courseId"], scope["timestamp"])
        )

    def upsert(self, *, where, data):
        scope = where["type_courseId_timestamp"]
        key = (scope["type"], scope["courseId"], scope["timestamp"])
        if key not in self.store:
            self.store[key] = SimpleNamespace(id=self.next_id)
            self.next_id += 1
        return self.store[key]


class _ProgressModel:
    def __init__(self):
        self.next_id = 1

    def upsert(self, *, where, data):
        row = SimpleNamespace(id=self.next_id)
        self.next_id += 1
        return row


class _Transaction:
    def __init__(self, generation, participant_rows, extra_models=None):
        self.analyticseligibilitygeneration = SimpleNamespace(
            find_unique=lambda **kwargs: {"generation": generation}
        )
        self.course = SimpleNamespace(
            find_unique=lambda **kwargs: {"isLearningAnalyticsEnabled": True}
        )
        self.participant_rows = participant_rows
        self.participantanalytics = None
        self.participantanalyticsresearchcontribution = None
        for name, model in (extra_models or {}).items():
            setattr(self, name, model)
        self.events = []

    def execute_raw(self, query, *parameters):
        self.events.append(("lock", query, parameters))

    def query_raw(self, query, *parameters):
        self.events.append(("validate", query, parameters))
        return self.participant_rows


class _TransactionContext:
    def __init__(self, transaction):
        self.transaction = transaction

    def __enter__(self):
        return self.transaction

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class _Database:
    def __init__(self, generation=0, extra_models=None):
        self.generation = generation
        self.extra_models = extra_models or {}
        self.transactions = []
        self.participantanalytics = _ParticipantAnalyticsModel()
        self.participantanalyticsresearchcontribution = _ContributionModel()

    def tx(self, *, max_wait, timeout):
        transaction = _Transaction(
            self.generation,
            [{"participantId": PARTICIPANT_ID, "choiceAt": CHOICE_AT}],
            self.extra_models,
        )
        transaction.participantanalytics = self.participantanalytics
        transaction.participantanalyticsresearchcontribution = (
            self.participantanalyticsresearchcontribution
        )
        self.transactions.append(transaction)
        return _TransactionContext(transaction)


class ResearchContributionTests(unittest.TestCase):
    def setUp(self):
        self.context = eligibility_module.AnalyticsEligibilityContext(
            generation=3,
            disclosure_version=eligibility_module.CURRENT_ANALYTICS_DISCLOSURE_VERSION,
            participants=(
                eligibility_module.EligibleParticipant(PARTICIPANT_ID, CHOICE_AT),
            ),
        )

    def _save(self, database, analytics_type, timestamp):
        save_participant_analytics(
            database,
            pd.DataFrame([_row()]),
            timestamp,
            analytics_type,
            self.context,
            source_window_start="2026-09-12T00:00:00.000Z",
            source_window_end="2026-09-12T23:59:59.999Z",
        )

    def test_daily_publication_retains_provenance_once(self):
        database = _Database(generation=3)

        self._save(database, "DAILY", "2026-09-12T00:00:00.000Z")

        transaction = database.transactions[0]
        contributions = transaction.participantanalyticsresearchcontribution
        self.assertEqual(len(contributions.creates), 1)
        created = contributions.creates[0]
        self.assertEqual(created["family"], "PARTICIPANT_ANALYTICS")
        self.assertEqual(created["generation"], 3)
        self.assertEqual(
            created["disclosureVersion"],
            eligibility_module.CURRENT_ANALYTICS_DISCLOSURE_VERSION,
        )
        self.assertEqual(created["choiceAt"], CHOICE_AT)
        self.assertEqual(created["participantAnalyticsId"], 1)
        self.assertEqual(
            created["sourceWindowStart"], "2026-09-12T00:00:00.000Z"
        )
        self.assertEqual(created["contributions"]["trialsCount"], 4)

    def test_no_op_republication_keeps_original_provenance(self):
        database = _Database(generation=3)
        self._save(database, "DAILY", "2026-09-12T00:00:00.000Z")

        self._save(database, "DAILY", "2026-09-12T00:00:00.000Z")

        transaction = database.transactions[1]
        contributions = transaction.participantanalyticsresearchcontribution
        # Only the first publication created a contribution.
        self.assertEqual(len(contributions.creates), 1)
        self.assertEqual(len(contributions.deletions), 1)

    def test_course_republication_replaces_contribution(self):
        database = _Database(generation=3)
        self._save(database, "COURSE", "1970-01-01T00:00:00.000Z")
        self._save(database, "COURSE", "1970-01-01T00:00:00.000Z")

        transaction = database.transactions[1]
        contributions = transaction.participantanalyticsresearchcontribution
        self.assertEqual(len(contributions.deletions), 2)
        self.assertEqual(len(contributions.creates), 2)
        self.assertEqual(
            contributions.deletions[-1]["scopeKey"],
            contributions.creates[-1]["scopeKey"],
        )
        self.assertIn("firstCorrectCount", contributions.creates[-1]["contributions"])

    def test_participant_outside_captured_cohort_publishes_nothing(self):
        database = _Database(generation=3)
        self.context = eligibility_module.AnalyticsEligibilityContext(
            generation=3,
            disclosure_version=eligibility_module.CURRENT_ANALYTICS_DISCLOSURE_VERSION,
            participants=(),
        )

        self._save(database, "DAILY", "2026-09-12T00:00:00.000Z")

        self.assertEqual(database.transactions, [])
        self.assertEqual(
            database.participantanalyticsresearchcontribution.creates,
            [],
        )

    def test_aggregated_publication_retains_participant_inputs(self):
        database = _Database(
            generation=3,
            extra_models={"aggregatedanalytics": _AggregateModel()},
        )

        save_aggregated_analytics(
            database,
            pd.DataFrame(
                [
                    {
                        "courseId": COURSE_ID,
                        "participantCount": 1,
                        "responseCount": 3,
                        "totalScore": 10,
                        "totalPoints": 12,
                        "totalXp": 9,
                    }
                ]
            ),
            "2026-09-12T00:00:00.000Z",
            "DAILY",
            self.context,
            df_participant=pd.DataFrame(
                [
                    {
                        "courseId": COURSE_ID,
                        "participantId": PARTICIPANT_ID,
                        "trialsCount": 4,
                        "responseCount": 3,
                        "totalScore": 10,
                        "totalPoints": 12,
                        "totalXp": 9,
                    }
                ]
            ),
            source_window_start="2026-09-12T00:00:00.000Z",
            source_window_end="2026-09-12T23:59:59.999Z",
        )

        created = database.participantanalyticsresearchcontribution.creates
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0]["family"], "AGGREGATED_ANALYTICS")
        self.assertEqual(created[0]["aggregatedAnalyticsId"], 1)
        self.assertEqual(created[0]["contributions"]["responseCount"], 3)
        self.assertEqual(
            created[0]["sourceWindowEnd"], "2026-09-12T23:59:59.999Z"
        )

        # a no-op re-run of a rolling window keeps the original provenance
        save_aggregated_analytics(
            database,
            pd.DataFrame(
                [
                    {
                        "courseId": COURSE_ID,
                        "participantCount": 1,
                        "responseCount": 3,
                        "totalScore": 10,
                        "totalPoints": 12,
                        "totalXp": 9,
                    }
                ]
            ),
            "2026-09-12T00:00:00.000Z",
            "DAILY",
            self.context,
            df_participant=pd.DataFrame(
                [
                    {
                        "courseId": COURSE_ID,
                        "participantId": PARTICIPANT_ID,
                        "trialsCount": 4,
                        "responseCount": 3,
                        "totalScore": 10,
                        "totalPoints": 12,
                        "totalXp": 9,
                    }
                ]
            ),
        )
        self.assertEqual(
            len(database.participantanalyticsresearchcontribution.creates), 1
        )

    def test_activity_progress_retains_participant_flags(self):
        database = _Database(
            generation=3,
            extra_models={"activityprogress": _ProgressModel()},
        )

        save_practice_quiz_progress(
            database,
            12,
            1,
            1,
            0,
            COURSE_ID,
            "quiz-1",
            self.context,
            participant_stats=[
                {
                    "participantId": PARTICIPANT_ID,
                    "responseCount": 3,
                    "minTrials": 2,
                    "started": True,
                    "completed": True,
                    "repeated": True,
                }
            ],
        )

        created = database.participantanalyticsresearchcontribution.creates
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0]["family"], "ACTIVITY_PROGRESS")
        self.assertEqual(created[0]["activityProgressId"], 1)
        self.assertTrue(created[0]["contributions"]["completed"])
        self.assertEqual(created[0]["scope"]["totalCourseParticipants"], 12)


if __name__ == "__main__":
    unittest.main()
