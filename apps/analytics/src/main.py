from prisma import Prisma

db = Prisma()

db.connect()

user = db.user.find_first()
print(user)

db.disconnect()
