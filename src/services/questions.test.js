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
    Versions: [${val.versions.map(({ description, instances, options }) => `
      Description: ${description}
      Instances: [${instances}]
      Options: {
        Choices: ${options.choices &&
          `[${options.choices.map(({ correct, name }) => `
            Correct: ${correct}
            Name: ${name}
          `)}
        ]`}
        Randomized: ${options.randomized}
        Restrictions: ${options.restrictions &&
          `{
          Max: ${options.restrictions.max}
          Min: ${options.restrictions.min}
          Type: ${options.restrictions.type}
        }`}
      }
    `)}]
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

    await setupTestEnv({
      email: 'testQuestions@bf.uzh.ch',
      password: 'somePassword',
      shortname: 'questi',
    })

    // login as a test user
    user = await AuthService.login(null, 'testQuestions@bf.uzh.ch', 'somePassword')
  })
  afterAll((done) => {
    mongoose.disconnect(done)
    user = undefined
  })

  describe('createQuestion', () => {
    const question = {
      description: 'blabla',
      options: {
        choices: [{ correct: false, name: 'option1' }, { correct: true, name: 'option2' }],
        randomized: true,
      },
      tags: ['ABCD', 'test'],
      title: 'question without tags',
      type: 'SC',
    }

    it('prevents creating a question without tags', () => {
      expect(QuestionService.createQuestion({
        ...question,
        tags: [],
      })).rejects.toEqual(new Error('NO_TAGS_SPECIFIED'))
    })

    it('prevents creating a question without options', () => {
      expect(QuestionService.createQuestion({
        ...question,
        options: undefined,
      })).rejects.toEqual(new Error('NO_OPTIONS_SPECIFIED'))
    })

    it('allows creating a valid SC question', async () => {
      const newQuestion = await QuestionService.createQuestion({ ...question, userId: user.id })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })

    it('allows creating a valid FREE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE',
        options: {
          restrictions: {
            min: 10,
            max: 100,
            type: 'RANGE',
          },
        },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })
  })
})
