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
  const questions = {}
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
        choices: [
          { correct: false, name: 'option1' },
          { correct: true, name: 'option2' },
          { correct: false, name: 'option2' },
        ],
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

    it('prevents creating a question with invalid solution', () => {
      expect(QuestionService.createQuestion({
        ...question,
        solution: { SC: [true] },
      })).rejects.toEqual(new Error('INVALID_SOLUTION'))
    })

    it('allows creating a valid SC question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        solution: { SC: [false, true, false] },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.SC = newQuestion
    })

    it('allows creating a valid MC question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        type: 'MC',
        userId: user.id,
        solution: { MC: [true, true, false] },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.MC = newQuestion
    })

    it('allows creating a valid FREE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE',
        options: {},
        solution: { FREE: 'Schweiz' },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.FREE = newQuestion
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
        solution: { FREE_RANGE: 56 },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.FREE_RANGE = newQuestion
    })

    it('allows creating a partly restricted FREE_RANGE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE_RANGE',
        options: {
          restrictions: {
            max: 20,
            min: null,
          },
        },
        solution: { FREE_RANGE: 10 },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.FREE_RANGE_PART = newQuestion
    })

    it('allows creating an unrestricted FREE_RANGE question', async () => {
      const newQuestion = await QuestionService.createQuestion({
        ...question,
        userId: user.id,
        type: 'FREE_RANGE',
        options: {
          restrictions: {
            max: null,
            min: null,
          },
        },
        solution: { FREE_RANGE: 56 },
      })

      expect(newQuestion.versions.length).toEqual(1)
      expect(newQuestion).toMatchSnapshot()

      questions.FREE_RANGE_OPEN = newQuestion
    })
  })

  describe('modifyQuestion', () => {
    it('allows modifying the question title', async () => {
      const modifiedQuestion = await QuestionService.modifyQuestion(questions.SC.id, questions.SC.user, {
        title: 'modified title',
      })

      expect(modifiedQuestion).toMatchSnapshot()
    })

    it('allows modifying the question tags', async () => {
      const modifiedQuestion = await QuestionService.modifyQuestion(questions.SC.id, questions.SC.user, {
        tags: ['ABCD', 'XYZ'],
      })

      expect(modifiedQuestion).toMatchSnapshot()
    })

    it('allows creating a new question version', async () => {
      const modifiedQuestion = await QuestionService.modifyQuestion(questions.SC.id, questions.SC.user, {
        description: 'This is the new description for version 2',
        options: {
          choices: [{ correct: true, name: 'option3' }, { correct: false, name: 'option4' }],
          randomized: true,
        },
      })

      expect(modifiedQuestion).toMatchSnapshot()
    })
  })
})
