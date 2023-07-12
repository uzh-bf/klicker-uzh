import mongoose from 'mongoose';

const { Schema, Types } = mongoose;
const { ObjectId } = Types;

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

LegacyQuestionInstance.index({ '$**': 1 });

const legacyConnection = mongoose.createConnection(`mongodb://${process.env.MONGO_URL_LEGACY}`, {
  keepAlive: true,
//   reconnectTries: Number.MAX_VALUE,
//   reconnectInterval: 1000,
})

const LegacyQuestionInstanceModel = legacyConnection.model('LegacyQuestionInstance', LegacyQuestionInstance);

export async function getLegacyResults(legacyQuestionInstanceId: string) {
    console.log("getLegacyResults method called")
    const legacyInstance = await LegacyQuestionInstanceModel.findById(legacyQuestionInstanceId);
    return legacyInstance ? legacyInstance.results : null;
}