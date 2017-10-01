require('dotenv').config()

const mongoose = require('mongoose')

const AuthService = require('./auth')
const QuestionService = require('./questions')

const { setupTestEnv } = require('../utils/testHelpers')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer({
  test: val => val.id && val.instances && val.tags && val.title && val.type && val.versions,
  print: val => `
    Title: ${val.title}
    Type: ${val.type}

    Instances: [${val.instances}]
    Tags: [${val.tags.map(tag => tag.name)}]
    Versions: ${val.versions.map(version => `
      Description: ${version.description}
      Instances: [${version.instances}]
      Options: [${version.options.map(option => `${option.name} ${option.correct}`)}]
    `)}
  `,
})

describe('QuestionService', () => {
  let user

  beforeAll(async () => {
    // connect to the database
    await mongoose.connect(`mongodb://${process.env.MONGO_URL}`, {
      keepAlive: true,
      reconnectTries: 10,
      useMongoClient: true,
    })

    await setupTestEnv({ email: 'testQuestions@bf.uzh.ch', password: 'somePassword', shortname: 'questi' })

    // login as a test user
    user = await AuthService.login(null, 'testQuestions@bf.uzh.ch', 'somePassword')
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    user = undefined
  })

  describe('createQuestion', () => {
    it('prevents creating a question without tags', () => {
      expect(QuestionService.createQuestion({
        description: 'blabla',
        tags: [],
        title: 'question without tags',
        type: 'SC',
        userId: user.id,
      })).rejects.toEqual(new Error('NO_TAGS_SPECIFIED'))
    })

    it('allows creating a valid question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        description: 'blabla',
        tags: ['ABCD', 'test'],
        title: 'valid question',
        type: 'SC',
        userId: user.id,
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })
  })
})
