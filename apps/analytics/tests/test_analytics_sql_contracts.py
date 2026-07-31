from __future__ import annotations

import unittest
from pathlib import Path

_MODULES = Path(__file__).resolve().parents[1] / "src" / "modules"


def _read_sql(*parts: str) -> str:
    return _MODULES.joinpath(*parts).read_text(encoding="utf-8")


class AnalyticsSqlContractTests(unittest.TestCase):
    def test_live_quiz_rollup_ranks_first_and_last_attempt_per_participant(self):
        statement = _read_sql("live_quiz_analytics", "aggregated_live_quiz_analytics.sql")

        self.assertIn('PARTITION BY lqr."participantId", lqr."instanceId"', statement)
        self.assertIn("attempt_asc = 1", statement)
        self.assertIn("attempt_asc = attempt_count", statement)
        self.assertNotIn("JOIN LATERAL", statement)

    def test_topic_clustering_requires_accepted_disclaimer(self):
        source = (_MODULES / "chat_topic_clustering" / "load_user_text.py").read_text(encoding="utf-8")

        self.assertIn('JOIN "ChatUsageCredits"', source)
        self.assertIn('cuc."participantId" = ct."participantId"', source)
        self.assertIn('cuc."chatbotId" = ct."chatbotId"', source)
        self.assertIn('cuc."acceptedDisclaimerId" = cb."disclaimerId"', source)
        self.assertIn('cuc."disclaimerDeclined" = false', source)

    def test_participant_chat_analytics_requires_current_disclaimer(self):
        statement = _read_sql("chat_analytics", "participant_chat_analytics.sql")

        self.assertIn('cuc."acceptedDisclaimerId" = cb."disclaimerId"', statement)
        self.assertIn('cuc."disclaimerDeclined" = false', statement)

    def test_semester_boundaries_match_naive_utc_storage_without_session_timezone(self):
        statement = _read_sql("platform_analytics", "platform_semester_analytics.sql")

        self.assertEqual(statement.count("make_timestamp("), 4)
        self.assertNotIn("make_timestamptz(", statement)

    def test_chat_distribution_extracts_naive_utc_timestamp_directly(self):
        statements = (
            _read_sql("aggregated_chat_analytics", "aggregated_chatbot_analytics.sql"),
            _read_sql("aggregated_chat_analytics", "aggregated_chatbot_analytics_weekly.sql"),
        )

        for statement in statements:
            with self.subTest(statement=statement[:40]):
                messages_cte = statement.index("messages AS")
                disclaimer_cte = statement.index("disclaimer_counts AS")
                self.assertIn("eligible_pairs AS", statement[:messages_cte])
                self.assertIn("JOIN eligible_pairs ep", statement[messages_cte:disclaimer_cte])
                self.assertIn('EXTRACT(ISODOW FROM "createdAt")', statement)
                self.assertIn('EXTRACT(HOUR   FROM "createdAt")', statement)
                self.assertIn("::timestamptz AT TIME ZONE 'UTC'", statement)
                self.assertIn('cuc."acceptedDisclaimerId" = cb."disclaimerId"', statement)
                self.assertIn('cuc."disclaimerDeclined" = false', statement)


if __name__ == "__main__":
    unittest.main()
