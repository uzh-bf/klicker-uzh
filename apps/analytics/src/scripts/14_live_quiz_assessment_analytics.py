# Populates ParticipantLiveQuizAnalytics and AggregatedLiveQuizAnalytics for all
# assessment-mode live quizzes. Normal-mode live quizzes are skipped (no per-participant
# response tracking exists for them today — see §3.12).

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
    compute_aggregated_live_quiz_analytics,
    compute_participant_live_quiz_analytics,
)
from src.modules.utils import analytics_mode, analytics_window_since, scoped_course_ids


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=analytics_window_since(),
        )

        if scope is not None and not scope:
            print(
                "[14_live_quiz_assessment_analytics] empty course scope — "
                "skipping live quiz analytics"
            )
            script_exit(script=__name__, started=started, rows_written=0)
            return

        print("Computing ParticipantLiveQuizAnalytics (assessment-mode only)")
        compute_participant_live_quiz_analytics(session, course_ids=scope, verbose=True)

        print("Computing AggregatedLiveQuizAnalytics (assessment-mode only)")
        compute_aggregated_live_quiz_analytics(session, course_ids=scope, verbose=True)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
