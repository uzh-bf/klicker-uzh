const mongoose = require('mongoose')
// const JWT = require('jsonwebtoken')

const AuthService = require('./auth')
const QuestionService = require('./questions')

mongoose.Promise = Promise
process.env.APP_SECRET = 'hello-world'

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
    await mongoose.connect('mongodb://klicker:klicker@ds161042.mlab.com:61042/klicker-dev')

    // login as a test user
    user = await AuthService.login(null, 'roland.schlaefli@bf.uzh.ch', 'abcdabcd')
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
