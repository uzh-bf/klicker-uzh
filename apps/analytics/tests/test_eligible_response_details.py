from datetime import datetime, timedelta, timezone
import unittest

from src.modules.eligible_response_details import summarize_eligible_element_responses
from src.modules.learning_analytics_eligibility import LEARNING_ANALYTICS_DISCLOSURE_VERSION


class EligibleResponseDetailsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.included_from = datetime(2026, 7, 30, 8, tzinfo=timezone.utc)
        self.participation = {
            "learningAnalyticsStatus": "INCLUDED",
            "learningAnalyticsDisclosureVersion": LEARNING_ANALYTICS_DISCLOSURE_VERSION,
            "learningAnalyticsIncludedFrom": self.included_from,
        }

    def detail(
        self,
        *,
        detail_id: int,
        created_at: datetime,
        participant_id: str = "eligible-participant",
        choices: list[int],
        participation: dict | None = None,
    ) -> dict:
        return {
            "id": detail_id,
            "participantId": participant_id,
            "createdAt": created_at,
            "response": {"choices": choices},
            "score": 1,
            "timeSpent": 10,
            "participation": participation or self.participation,
        }

    def test_rebuilds_counters_only_from_eligible_detail_rows(self) -> None:
        excluded_participation = {
            **self.participation,
            "learningAnalyticsStatus": "EXCLUDED",
            "learningAnalyticsIncludedFrom": None,
        }
        element = {
            "id": 42,
            "elementData": {
                "type": "SC",
                "options": {
                    "choices": [
                        {"ix": 0, "correct": True},
                        {"ix": 1, "correct": False},
                    ]
                },
            },
            "detailResponses": [
                self.detail(
                    detail_id=1,
                    created_at=self.included_from - timedelta(seconds=1),
                    choices=[1],
                ),
                self.detail(
                    detail_id=2,
                    created_at=self.included_from,
                    choices=[0],
                ),
                self.detail(
                    detail_id=3,
                    created_at=self.included_from + timedelta(seconds=1),
                    choices=[1],
                ),
                self.detail(
                    detail_id=4,
                    created_at=self.included_from + timedelta(seconds=1),
                    participant_id="excluded-participant",
                    choices=[0],
                    participation=excluded_participation,
                ),
            ],
        }

        self.assertEqual(
            summarize_eligible_element_responses(element),
            [
                {
                    "id": 2,
                    "participantId": "eligible-participant",
                    "elementInstanceId": 42,
                    "trialsCount": 2,
                    "totalScore": 2,
                    "averageTimeSpent": 10,
                    "correctCount": 1,
                    "partialCorrectCount": 0,
                    "wrongCount": 1,
                    "firstResponseCorrectness": "CORRECT",
                    "lastResponseCorrectness": "WRONG",
                }
            ],
        )

    def test_excludes_free_text_content_from_learning_analytics(self) -> None:
        element = {
            "id": 43,
            "elementData": {
                "type": "FREE_TEXT",
                "options": {"solutions": ["distinctive answer"]},
            },
            "detailResponses": [
                {
                    **self.detail(
                        detail_id=5,
                        created_at=self.included_from,
                        choices=[],
                    ),
                    "response": {"value": "distinctive answer"},
                }
            ],
        }

        self.assertEqual(summarize_eligible_element_responses(element), [])


if __name__ == "__main__":
    unittest.main()
