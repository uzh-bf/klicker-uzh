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
from src.modules.utils import scoped_course_ids

db = Prisma()
db.connect()

scope = scoped_course_ids(db)
if scope is not None and not scope:
    print(
        "[14_live_quiz_assessment_analytics] empty course scope — skipping live quiz analytics"
    )
else:
    print("Computing ParticipantLiveQuizAnalytics (assessment-mode only)")
    compute_participant_live_quiz_analytics(db, course_ids=scope, verbose=True)

    print("Computing AggregatedLiveQuizAnalytics (assessment-mode only)")
    compute_aggregated_live_quiz_analytics(db, course_ids=scope, verbose=True)

db.disconnect()
