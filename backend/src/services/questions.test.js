require('dotenv').config()

const mongoose = require('mongoose')

const QuestionService = require('./questions')
const { initializeDb } = require('../lib/test/setup')
const { questionSerializer } = require('../lib/test/serializers')

mongoose.Promise = Promise

// define how jest should serialize objects into snapshots
// we need to strip ids and dates as they are always changing
expect.addSnapshotSerializer(questionSerializer)

describe('QuestionService', () => {
  let user

  beforeAll(async () => {
    ({ user } = await initializeDb({
      mongoose,
      email: 'testQuestions@bf.uzh.ch',
      shortname: 'questi',
      withLogin: true,
    }))
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

    it('allows creating a valid MC question', async () => {
      const newQuestion = await QuestionService.createQuestion({ ...question, type: 'MC', userId: user.id })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })

    it('allows creating a valid FREE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE',
        options: {},
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })

    it('allows creating a valid FREE_RANGE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE_RANGE',
        options: {
          restrictions: {
            min: 10,
            max: 100,
          },
        },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()
    })
  })
})
