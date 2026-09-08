import unittest
from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path
from unittest.mock import ANY

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from modules import analytics_eligibility as eligibility_module


PARTICIPANT_ID = "00000000-0000-0000-0000-000000000001"
CHOICE_AT = datetime(2026, 9, 1, tzinfo=timezone.utc)


class _Model:
    def __init__(self, row=None, rows=None):
        self.row = row
        self.rows = rows or []
        self.find_unique_calls = []
        self.find_many_calls = []

    def find_unique(self, *, where):
        self.find_unique_calls.append(where)
        return self.row

    def find_many(self, *, where):
        self.find_many_calls.append(where)
        return self.rows


class _SyntheticColumn:
    def __init__(self, values):
        self.values = values

    def dropna(self):
        return self.values

    def astype(self, _type):
        return self

    def isin(self, values):
        return [value in values for value in self.values]


class _SyntheticFrame:
    empty = False

    def __contains__(self, key):
        return key == "courseId"

    def __getitem__(self, key):
        if isinstance(key, str):
            return _SyntheticColumn(["course-1"])
        return self

    @property
    def loc(self):
        return self

    def copy(self):
        return self


class _Transaction:
    def __init__(self, generation, participant_rows):
        self.analyticseligibilitygeneration = _Model({"generation": generation})
        self.course = _Model(row={"isLearningAnalyticsEnabled": True})
        self.participant_rows = participant_rows
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
    def __init__(self, generation=0, participant_rows=None):
        self.analyticseligibilitygeneration = _Model(None)
        self.course = _Model(
            row={"isLearningAnalyticsEnabled": True},
            rows=[{"id": "course-1"}],
        )
        self.generation = generation
        self.participant_rows = participant_rows or []
        self.transactions = []
        self.tx_parameters = None

    def query_raw(self, query, *parameters):
        self.eligibility_query = query
        self.eligibility_parameters = parameters
        return [{"participantId": PARTICIPANT_ID, "choiceAt": CHOICE_AT}]

    def tx(self, *, max_wait, timeout):
        if not isinstance(max_wait, (int, timedelta)) or not isinstance(timeout, (int, timedelta)):
            raise TypeError("Prisma transaction bounds must be int or timedelta values")
        self.tx_parameters = (max_wait, timeout)
        transaction = _Transaction(self.generation, self.participant_rows)
        self.transactions.append(transaction)
        return _TransactionContext(transaction)


class AnalyticsEligibilityTests(unittest.TestCase):
    def setUp(self):
        self.context = eligibility_module.AnalyticsEligibilityContext(
            generation=0,
            disclosure_version="v1",
            participants=(eligibility_module.EligibleParticipant(PARTICIPANT_ID, CHOICE_AT),),
        )

    def test_capture_defaults_missing_generation_and_binds_disclosure(self):
        database = _Database()

        captured = eligibility_module.capture_analytics_eligibility(database)

        self.assertEqual(captured.generation, 0)
        self.assertEqual(captured.participant_ids, (PARTICIPANT_ID,))
        self.assertEqual(database.eligibility_parameters, ("v1",))
        self.assertIn("NOT EXISTS", database.eligibility_query)
        self.assertIn("completedAt", database.eligibility_query)
        self.assertIn("$1", database.eligibility_query)

    def test_prospective_filter_keeps_choice_boundary_only(self):
        records = [
            {
                "participantId": PARTICIPANT_ID,
                "createdAt": "2026-08-31T23:59:59Z",
            },
            {
                "participantId": PARTICIPANT_ID,
                "createdAt": "2026-09-01T00:00:00Z",
            },
            {
                "participantId": "objector",
                "createdAt": "2026-09-02T00:00:00Z",
            },
        ]

        filtered = eligibility_module.filter_records_by_eligibility(records, self.context)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["createdAt"], "2026-09-01T00:00:00Z")

    def test_publication_locks_before_validating_and_writing(self):
        database = _Database(
            participant_rows=[
                {"participantId": PARTICIPANT_ID, "choiceAt": CHOICE_AT},
            ]
        )
        events = []

        def write(transaction):
            events.append("write")

        eligibility_module.publish_analytics(database, self.context, ("course-1",), write)

        self.assertEqual(events, ["write"])
        self.assertEqual(
            database.tx_parameters,
            (timedelta(seconds=10), timedelta(seconds=60)),
        )
        self.assertEqual(
            database.transactions[0].events,
            [
                (
                    "lock",
                    "SELECT pg_advisory_xact_lock(CAST($1 AS integer), CAST($2 AS integer))",
                    eligibility_module.ANALYTICS_ADVISORY_LOCK,
                ),
                ("validate", ANY, (PARTICIPANT_ID, "v1")),
            ],
        )

    def test_synthetic_doubles_reject_unsupported_prisma_keywords(self):
        model = _Model()
        with self.assertRaises(TypeError):
            model.find_unique(where={"id": "course-1"}, select={"id": True})
        with self.assertRaises(TypeError):
            model.find_many(where={}, select={"id": True})

        database = _Database()
        with self.assertRaises(TypeError):
            database.tx(max_wait=10_000, timeout=60_000, unsupported=True)

    def test_course_queries_use_generated_model_signatures(self):
        database = _Database()

        self.assertTrue(eligibility_module.is_course_learning_analytics_enabled(database, "course-1"))
        filtered = eligibility_module.filter_dataframe_by_enabled_courses(
            database,
            _SyntheticFrame(),
        )

        self.assertIsInstance(filtered, _SyntheticFrame)
        self.assertEqual(database.course.find_unique_calls, [{"id": "course-1"}])
        self.assertEqual(
            database.course.find_many_calls,
            [
                {
                    "id": {"in": ["course-1"]},
                    "isLearningAnalyticsEnabled": True,
                }
            ],
        )

    def test_generation_drift_aborts_without_writing_and_empty_cohort_is_noop(self):
        changed_database = _Database(
            generation=1,
            participant_rows=[
                {"participantId": PARTICIPANT_ID, "choiceAt": CHOICE_AT},
            ],
        )
        writes = []

        with self.assertRaises(eligibility_module.AnalyticsEligibilityChanged):
            eligibility_module.publish_analytics(
                changed_database,
                self.context,
                ("course-1",),
                lambda transaction: writes.append("write"),
            )

        self.assertEqual(writes, [])

        empty_database = _Database()
        empty_context = eligibility_module.AnalyticsEligibilityContext(0, "v1", ())
        eligibility_module.publish_analytics(
            empty_database,
            empty_context,
            ("course-1",),
            lambda transaction: writes.append("unexpected write"),
        )
        self.assertEqual(empty_database.transactions, [])


if __name__ == "__main__":
    unittest.main()
