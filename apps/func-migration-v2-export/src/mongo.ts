import { InvocationContext } from '@azure/functions'
import { Db, MongoClient } from 'mongodb'

let mongo: Db

async function getMongoDB(context: InvocationContext) {
  if (!mongo) {
    try {
      const mongoURL = 'mongodb://klicker:klicker@localhost:27017'

      const mongoClient = new MongoClient(mongoURL)
      await mongoClient.connect()

      mongo = mongoClient.db('klicker-prod')
    } catch (e) {
      context.error(e)
    }
  }

  return mongo
}

export default getMongoDB
