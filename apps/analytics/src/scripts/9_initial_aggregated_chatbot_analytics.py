# AggregatedChatbotAnalytics rollup across DAILY / WEEKLY / MONTHLY / COURSE.
# Raw SQL in the aggregated_chat_analytics module does the aggregation; this
# script just iterates the date windows.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
    compute_aggregated_chatbot_analytics,
)
from src.modules.utils import analytics_window_since, iter_analytics_windows

db = Prisma()
db.connect()

iter_analytics_windows(
    db,
    compute_aggregated_chatbot_analytics,
    label="aggregated chatbot analytics",
    windows_since=analytics_window_since(),
    verbose=False,
)

db.disconnect()
