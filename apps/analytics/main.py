import os
from prisma import Prisma
import pandas as pd

db = Prisma()

db.connect()

user = db.user.find_first()
print(user)

db.disconnect()
