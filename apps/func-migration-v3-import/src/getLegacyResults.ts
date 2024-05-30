import mongoose from 'mongoose'

const { Schema, Types } = mongoose
const { ObjectId } = Types

const Response = new mongoose.Schema(
  {
    participant: { type: String, ref: 'SessionParticipant' },
    value: { type: Object, required: true },
  },
  { timestamps: true }
)

const Results = new mongoose.Schema(
  {
    CHOICES: [{ type: Number }],
    FREE: { type: Object },
    totalParticipants: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const LegacyQuestionInstance = new mongoose.Schema(
  {
    isOpen: { type: Boolean, default: false },
    question: { type: ObjectId, ref: 'Question', required: true, index: true },
    session: { type: ObjectId, ref: 'Session', required: true, index: true },
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    version: { type: Number, min: 0, required: true },
    blockedParticipants: [{ type: String }],
    responses: [{ type: Response }],
    dropped: [{ type: Response }],
    results: { type: Results },
  },
  { timestamps: true }
)

LegacyQuestionInstance.index({ '$**': 1 })

const legacyConnection = mongoose.createConnection(
  process.env.MIGRATION_LEGACY_MONGO_CONNECTION_STRING as string,
  {
    dbName: 'klicker-prod',
    authSource: 'admin',
    keepAlive: true,
  }
)

process.on('SIGINT', function () {
  legacyConnection.close()
})

const LegacyQuestionInstanceModel = legacyConnection.model(
  'LegacyQuestionInstance',
  LegacyQuestionInstance,
  'questioninstances'
)

export async function getLegacyResults(legacyQuestionInstanceId: string) {
  const legacyInstance = await LegacyQuestionInstanceModel.findById(
    new ObjectId(legacyQuestionInstanceId)
  )
  return legacyInstance ? legacyInstance.results : null
}

export function closeLegacyConnection() {
  legacyConnection.close()
}
