# Builds ParticipantChatOutcome — the per-participant-per-course join between
# chat volume (ParticipantChatAnalytics type=COURSE) and quiz performance
# (ParticipantPerformance). Also updates ParticipantCourseAnalytics.hasChatActivity.
#
# Hatchet/process ordering guarantees that scripts 4 (ParticipantPerformance) and
# 8 (ParticipantChatAnalytics) have completed before this reconciliation runs.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
    reconcile_chat_quiz_correlation,
    report_source_counts,
)

db = Prisma()
db.connect()

report_source_counts(db, verbose=True)
reconcile_chat_quiz_correlation(db, verbose=True)

db.disconnect()
