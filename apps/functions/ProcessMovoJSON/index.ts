import { AzureFunction, Context } from '@azure/functions'
const {
  QuestionModel,
  SessionModel,
  UserModel,
  TagModel,
  QuestionInstanceModel,
} = require('@klicker-uzh/db')
const { v4: uuidv4 } = require('uuid')
const mongoose = require('mongoose')
import objHash from 'object-hash'

const { ObjectId } = mongoose.Types

function prepareDemoSessionData({
  id,
  name,
  user,
  blockInstances,
  blockStatus = 'PLANNED',
  ...rest
}) {
  return new SessionModel({
    status: 'CREATED',
    execution: 0,
    activeBlock: -1,
    activeStep: 0,
    participants: [],
    confusionTS: [],
    feedbacks: [],
    ...rest,
    _id: id,
    settings: {
      isParticipantAuthenticationEnabled: false,
      isConfusionBarometerActive: true,
      isEvaluationPublic: false,
      isFeedbackChannelActive: true,
      isFeedbackChannelPublic: true,
      authenticationMode: 'NONE',
      storageMode: 'SECRET',
    },
    namespace: uuidv4(),
    name,
    blocks: blockInstances.map((instances) => ({
      execution: 1,
      status: blockStatus,
      timeLimit: -1,
      randomSelection: -1,
      showSolutions: false,
      instances,
    })),
    activeInstances: [],
    user,
  })
}

/**
 * Data import from movo.ch
 * @param {String} dataset Movo Dataset as stringified JSON object
 */
const movoImport = async ({ userId, dataset }) => {
  const movoObject = JSON.parse(dataset)
  const user = await UserModel.findById(userId)

  // this variable is an object with the hashes of all created questions as keys and their Ids as values
  const questionHashes = {}

  // create import from movo tag
  const movoTag = await new TagModel({
    name: 'Import from Movo',
    questions: [],
    user: userId,
  }).save()
  user.tags.push(movoTag.id)

  try {
    movoObject.forEach((questionSet, index1) =>
      questionSet.questions.forEach((question, index2) => {
        const questionHash = objHash(question)
        if (questionHashes[questionHash] === 'TODO') {
          movoObject[index1].questions[index2].duplicate = true
        } else {
          questionHashes[questionHash] = 'TODO'
          movoObject[index1].questions[index2].duplicate = false
        }
        movoObject[index1].questions[index2].hash = questionHash
      })
    )

    let questions = []
    let questionInstanceIds = []

    questions = await Promise.all(
      movoObject.map(async (questionSet) => {
        let tempQuestions = []
        if (questionSet.questions && questionSet.questions.length !== 0) {
          // create questions for each questionSet (including deduplication)
          tempQuestions = await Promise.all(
            questionSet.questions.map(async (question) => {
              // Check if the question already exists and skip it if so
              if (question.duplicate === true) {
                return null
              }

              // If question does not exist yet, create it
              const newQuestion = await new QuestionModel({
                tags: [movoTag.id],
                title: question.title,
                type: question.type,
                user: userId,
                versions: [
                  {
                    content: question.title,
                    description: question.title,
                    options: {
                      SC: question.options.SC,
                      MC: question.options.MC,
                      FREE_RANCE: null,
                    },
                    files: [],
                    solution: undefined,
                  },
                ],
              }).save()

              movoTag.questions.push(newQuestion.id)
              user.questions.push(newQuestion.id)
              questionHashes[question.hash] = newQuestion.id

              return newQuestion
            })
          )
        }
        return tempQuestions
      })
    )

    questions = questions.flat().filter((question) => question !== null)

    movoObject.forEach(async (questionSet) => {
      if (questionSet.questions && questionSet.questions.length !== 0) {
        // Get questions from duplicate free question array that are part of the considered questionSet / session
        const sessionQuestionIds = questionSet.questions.map(
          (question) => questionHashes[question.hash]
        )
        const sessionQuestions = questions.filter((question) =>
          sessionQuestionIds.includes(question.id)
        )

        // Test if every question in the block has results - otherwise treat it like missing results
        if (
          questionSet.questions.every(
            (question) =>
              question.results !== null && question.results !== undefined
          )
        ) {
          // Create instances with results
          const sessionId = ObjectId()

          questionInstanceIds = await sessionQuestions.reduce(
            async (acc, question, currentIndex) => {
              const newInstance = await new QuestionInstanceModel({
                question: question.id,
                session: sessionId,
                user: userId,
                version: 0,
                results: questionSet.questions[currentIndex].results,
              })

              newInstance.save()
              question.instances.push(newInstance.id)
              return [...(await acc), newInstance.id]
            },
            Promise.resolve([])
          )

          // Create Session with results
          const movoSession = prepareDemoSessionData({
            id: sessionId,
            name: questionSet.setName,
            status: 'COMPLETED',
            user: userId,
            blockInstances: questionInstanceIds.map((instanceId) => [
              instanceId,
            ]),
            blockStatus: 'EXECUTED',
            startedAt: new Date(`${questionSet.SetVotingDate}T10:00:00`),
            finishedAt: new Date(`${questionSet.SetVotingDate}T11:00:00`),
            createdAt: new Date(`${questionSet.SetVotingDate}T10:00:00`),
          })
          await movoSession.save()

          user.sessions.push(movoSession.id)
        } else {
          // Create instances without results
          const sessionId = ObjectId()

          questionInstanceIds = await sessionQuestions.reduce(
            async (acc, question) => {
              const newInstance = await new QuestionInstanceModel({
                question: question.id,
                session: sessionId,
                user: userId,
                version: 0,
                results: null,
              })
              newInstance.save()
              question.instances.push(newInstance.id)
              return [...(await acc), newInstance.id]
            },
            Promise.resolve([])
          )

          // Create Session without results
          const movoSession = prepareDemoSessionData({
            id: sessionId,
            user: userId,
            name: questionSet.setName,
            blockInstances: questionInstanceIds.map((instanceId) => [
              instanceId,
            ]),
            createdAt: new Date(`${questionSet.SetVotingDate}T10:00:00`),
          })
          await movoSession.save()

          user.sessions.push(movoSession.id)
        }
      }
    })

    await Promise.all([user.save(), movoTag.save()])
  } catch (error) {
    console.log(error)
  }
  return true
}

const blobTrigger: AzureFunction = async function (
  context: Context,
  myBlob: any
): Promise<void> {
  const mongoConfig = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: false,
  }

  mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
    ...mongoConfig,
    auth: {
      user: process.env.MONGO_USER,
      password: process.env.MONGO_PASS,
    },
  })

  // activate mongoose debug mode (log all queries)
  mongoose.set('debug', true)

  // Make Mongoose use `findOneAndUpdate()`. Note that this option is `true`
  // by default, you need to set it to false.
  mongoose.set('useFindAndModify', false)

  mongoose.connection
    .once('open', () => {
      console.log('[mongo] Connection to MongoDB established.')
    })
    .on('error', (error) => {
      throw new Error(`[mongo] Could not connect to MongoDB: ${error}`)
    })

  // await movoImport({
  //   userId: '',
  //   dataset: '',
  // })

  context.log(
    'Blob trigger function processed blob \n Name:',
    context.bindingData.name,
    '\n Blob Size:',
    myBlob.length,
    'Bytes'
  )

  // TODO: if not done automatically, remove the blob from the azure container to ensure that only non-processed files are still listed
}

export default blobTrigger
