# Builds ParticipantChatOutcome — the per-participant-per-course join between
# chat volume (ParticipantChatAnalytics type=COURSE) and quiz performance
# (ParticipantPerformance). Also updates ParticipantCourseAnalytics.hasChatActivity.
#
# Hatchet/process ordering guarantees that scripts 4 (ParticipantPerformance)
# and 8 (ParticipantChatAnalytics) completed before this reconciliation runs.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
    reconcile_chat_quiz_correlation,
    report_source_counts,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    check_analytics_cancellation,
    scoped_course_ids,
)


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=analytics_window_since(),
        )

        report_source_counts(session, course_ids=scope, verbose=True)
        check_analytics_cancellation()
        reconcile_chat_quiz_correlation(session, course_ids=scope, verbose=True)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
