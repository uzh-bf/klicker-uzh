# Populates ParticipantLiveQuizAnalytics and AggregatedLiveQuizAnalytics for all
# assessment-mode live quizzes. Normal-mode live quizzes are skipped (no per-participant
# response tracking exists for them today — see §3.12).

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
    compute_participant_live_quiz_analytics,
    compute_aggregated_live_quiz_analytics,
)

db = Prisma()
db.connect()

print("Computing ParticipantLiveQuizAnalytics (assessment-mode only)")
compute_participant_live_quiz_analytics(db, verbose=True)

print("Computing AggregatedLiveQuizAnalytics (assessment-mode only)")
compute_aggregated_live_quiz_analytics(db, verbose=True)

db.disconnect()
