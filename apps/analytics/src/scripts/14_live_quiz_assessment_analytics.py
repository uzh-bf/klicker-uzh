# Populates ParticipantLiveQuizAnalytics and AggregatedLiveQuizAnalytics for all
# assessment-mode live quizzes. Normal-mode live quizzes are skipped (no per-participant
# response tracking exists for them today — see §3.12).

from src.modules.live_quiz_analytics.run_live_quiz_analytics import (
    run_live_quiz_analytics,
)
from src.modules.utils import analytics_run_config_from_env


def main() -> None:
    run_live_quiz_analytics(analytics_run_config_from_env())


if __name__ == "__main__":
    main()
