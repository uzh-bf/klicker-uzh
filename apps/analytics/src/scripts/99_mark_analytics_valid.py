# Flips Course.areAnalyticsValid / analyticsLastComputedAt / chatAnalyticsValidAt for
# every course that ended up with analytics rows written in this run.
# Must be the LAST script in the analytics pipeline.

import sys
from prisma import Prisma

sys.path.append("../../")

from src.modules.analytics_validity.mark_analytics_valid import mark_analytics_valid

db = Prisma()
db.connect()

mark_analytics_valid(db, verbose=True)

db.disconnect()
