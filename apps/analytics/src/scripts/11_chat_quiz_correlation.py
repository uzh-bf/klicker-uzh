# Builds ParticipantChatOutcome — the per-participant-per-course join between
# chat volume (ParticipantChatAnalytics type=COURSE) and quiz performance
# (ParticipantPerformance). Also updates ParticipantCourseAnalytics.hasChatActivity.
#
# Preconditions: script 4 (ParticipantPerformance) AND script 8 (ParticipantChatAnalytics)
# must have run for the target courses. Fails loud if either is empty.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
    AnalyticsNotReadyError,
    assert_preconditions,
    compute_participant_chat_outcomes,
    update_has_chat_activity,
)

db = Prisma()
db.connect()

try:
    assert_preconditions(db, verbose=True)
except AnalyticsNotReadyError as exc:
    db.disconnect()
    print(f"ERROR: {exc}")
    sys.exit(1)

print("Building ParticipantChatOutcome rows")
compute_participant_chat_outcomes(db, verbose=True)

print("Updating ParticipantCourseAnalytics.hasChatActivity")
update_has_chat_activity(db, verbose=True)

db.disconnect()
