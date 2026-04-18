# ParticipantChatAnalytics rollup across DAILY / WEEKLY / MONTHLY / COURSE.
# Raw SQL in the chat_analytics module does the aggregation; this script just
# iterates the date windows.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.chat_analytics.compute_participant_chat_analytics import (
    compute_participant_chat_analytics,
)
from src.modules.utils import analytics_window_since, iter_analytics_windows

db = Prisma()
db.connect()

iter_analytics_windows(
    db,
    compute_participant_chat_analytics,
    label="participant chat analytics",
    windows_since=analytics_window_since(),
    verbose=False,
)

db.disconnect()
