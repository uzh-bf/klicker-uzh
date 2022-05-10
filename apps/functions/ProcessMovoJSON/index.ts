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
const objHash = require('object-hash')
const axios = require('axios')

const { ObjectId } = mongoose.Types

async function sendTeamsNotification(scope, text) {
  if (process.env.TEAMS_WEBHOOK) {
    return axios.post(process.env.TEAMS_WEBHOOK, {
      text: `[${process.env.TEAMS_ENV}:${scope}] ${text}`,
    })
  }

  return null
}

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
 */
const movoImport = async ({ userId, dataset }) => {
  const movoObject = JSON.parse(dataset)

  const user = await UserModel.findById(userId)

  // this variable is an object with the hashes of all created questions as keys and their Ids as values
  const questionHashes = {}

  try {
    // create import from movo tag
    const movoTag = await new TagModel({
      name: 'Import from Movo',
      questions: [],
      user: userId,
    }).save()
    user.tags.push(movoTag.id)

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
                      FREE_RANGE: null,
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
    return false
  }
  return user
}

const blobTrigger: AzureFunction = async function (
  context: Context,
  blob: any
): Promise<void> {
  context.log(
    'Blob trigger function processed blob \n UserID:',
    context.bindingData.userId,
    '\n Blob Size:',
    blob.length,
    'Bytes'
  )

  const dataset = blob.toString('utf8')

  await mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: false,
    auth: {
      user: process.env.MONGO_USER,
      password: process.env.MONGO_PASS,
    },
  })

  try {
    mongoose.connection
      .once('open', () => {
        console.log('[movo] Connection to MongoDB established.')
      })
      .on('error', (error) => {
        throw new Error(`[movo] Could not perform migration: ${error}`)
      })

    const importedUser = await movoImport({
      userId: context.bindingData.userId,
      dataset,
    })

    if (!importedUser) {
      throw new Error('[movo] Import not successful')
    }

    const result = await axios.post(
      process.env.API_URL,
      {
        query: `mutation movoNotification($userId: ID!, $token: String!) { movoNotification(userId: $userId, token: $token) }`,
        variables: {
          userId: context.bindingData.userId,
          token: process.env.MOVO_NOTIFICATION_TOKEN,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    sendTeamsNotification(
      'func/movo',
      `Successful import for user ${importedUser.email}`
    )
  } catch (e) {
    console.error(e)
    sendTeamsNotification(
      'func/movo',
      `Failed import for user ${context.bindingData.userId} with error ${e.message}`
    )
  } finally {
    mongoose.disconnect()
  }
}

export default blobTrigger
