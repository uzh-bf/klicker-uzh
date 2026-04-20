# Builds ParticipantChatOutcome — the per-participant-per-course join between
# chat volume (ParticipantChatAnalytics type=COURSE) and quiz performance
# (ParticipantPerformance). Also updates ParticipantCourseAnalytics.hasChatActivity.
#
# Preconditions: script 4 (ParticipantPerformance) AND script 8 (ParticipantChatAnalytics)
# must have run for the target courses. Fails loud if either is empty.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
    AnalyticsNotReadyError,
    assert_preconditions,
    compute_participant_chat_outcomes,
    update_has_chat_activity,
)


def main() -> None:
    with SessionLocal() as session:
        try:
            assert_preconditions(session, verbose=True)
        except AnalyticsNotReadyError as exc:
            print(f"ERROR: {exc}")
            sys.exit(1)

        print("Building ParticipantChatOutcome rows")
        compute_participant_chat_outcomes(session, verbose=True)

        print("Updating ParticipantCourseAnalytics.hasChatActivity")
        update_has_chat_activity(session, verbose=True)


if __name__ == "__main__":
    main()
