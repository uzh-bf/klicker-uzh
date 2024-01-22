import { Db, MongoClient } from 'mongodb'

let mongo: Db

async function getMongoDB() {
  if (!mongo) {
    try {
      const mongoURL = process.env.MIGRATION_MONGO_CONNECTION_STRING as string

      const mongoClient = new MongoClient(mongoURL)
      await mongoClient.connect()

      mongo = mongoClient.db('klicker-prod')
    } catch (e) {
      console.error(e)
    }
  }

  return mongo
}

export default getMongoDB
