# Populates ParticipantLiveQuizAnalytics and AggregatedLiveQuizAnalytics for all
# assessment-mode live quizzes. Normal-mode live quizzes are skipped (no per-participant
# response tracking exists for them today — see §3.12).

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
    compute_aggregated_live_quiz_analytics,
    compute_participant_live_quiz_analytics,
)
from src.modules.utils import scoped_course_ids


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        if scope is not None and not scope:
            print(
                "[14_live_quiz_assessment_analytics] empty course scope — "
                "skipping live quiz analytics"
            )
            return

        print("Computing ParticipantLiveQuizAnalytics (assessment-mode only)")
        compute_participant_live_quiz_analytics(session, course_ids=scope, verbose=True)

        print("Computing AggregatedLiveQuizAnalytics (assessment-mode only)")
        compute_aggregated_live_quiz_analytics(session, course_ids=scope, verbose=True)


if __name__ == "__main__":
    main()
