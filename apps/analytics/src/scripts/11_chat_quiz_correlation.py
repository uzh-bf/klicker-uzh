# Builds ParticipantChatOutcome — the per-participant-per-course join between
# chat volume (ParticipantChatAnalytics type=COURSE) and quiz performance
# (ParticipantPerformance). Also updates ParticipantCourseAnalytics.hasChatActivity.
#
# Preconditions: script 4 (ParticipantPerformance) AND script 8 (ParticipantChatAnalytics)
# must have run for the target courses. Fails loud if either is empty.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
    AnalyticsNotReadyError,
    assert_preconditions,
    compute_participant_chat_outcomes,
    update_has_chat_activity,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
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

        try:
            assert_preconditions(session, course_ids=scope, verbose=True)
        except AnalyticsNotReadyError as exc:
            print(f"ERROR: {exc}")
            raise

        print("Building ParticipantChatOutcome rows")
        compute_participant_chat_outcomes(session, course_ids=scope, verbose=True)

        print("Updating ParticipantCourseAnalytics.hasChatActivity")
        update_has_chat_activity(session, course_ids=scope, verbose=True)

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
