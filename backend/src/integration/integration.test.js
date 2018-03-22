const request = require('supertest')
const mongoose = require('mongoose')

const server = require('../app')
const { initializeDb } = require('../lib/test/setup')
const queries = require('./queries')
const mutations = require('./mutations')
const { QuestionTypes } = require('../constants')

process.env.NODE_ENV = 'test'

const serializers = [...queries.serializers, ...mutations.serializers]
serializers.forEach(serializer => expect.addSnapshotSerializer(serializer))

const sendQuery = (body, authCookie) => {
  if (authCookie) {
    return request(server)
      .post('/graphql')
      .set('Cookie', authCookie)
      .send(body)
  }

  return request(server)
    .post('/graphql')
    .send(body)
}

// ensure that there were no errors with the graphql request
const ensureNoErrors = (response) => {
  expect(response.body.errors).toBeUndefined()
  return response.body.data
}

describe('Integration', () => {
  let authCookie
  let sessionId
  const questions = {}

  beforeAll(async () => {
    await initializeDb({ mongoose, email: 'testIntegration@bf.uzh.ch', shortname: 'integr' })
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await server.close()
    authCookie = null
  })

  describe('Login', () => {
    it('works with valid credentials', async () => {
      // send a login request
      const response = await sendQuery({
        query: mutations.LoginMutation,
        variables: { email: 'testIntegration@bf.uzh.ch', password: 'somePassword' },
      })

      const data = ensureNoErrors(response)
      expect(data).toBeTruthy()

      // save the authorization cookie
      authCookie = response.header['set-cookie']
      expect(authCookie.length).toEqual(1)
    })
  })

  describe('Passwords', () => {
    it('can be updated', async () => {
      ensureNoErrors(await sendQuery(
        {
          query: mutations.ChangePasswordMutation,
          variables: { newPassword: 'someOtherPassword' },
        },
        authCookie,
      ))
    })

    it('can be requested', async () => {
      ensureNoErrors(await sendQuery({
        query: mutations.RequestPasswordMutation,
        variables: { email: 'testIntegration@bf.uzh.ch' },
      }))
    })
  })

  describe('Question Creation', () => {
    it('creates SC questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test SC',
            description: 'This is a simple SC question.',
            type: 'SC',
            options: {
              choices: [{ correct: false, name: 'option1' }, { correct: true, name: 'option2' }],
              randomized: false,
            },
            solution: {
              SC: [false, true],
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.SC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates MC questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test MC',
            description: 'This is a simple MC question.',
            type: 'MC',
            options: {
              choices: [
                { correct: false, name: 'option1' },
                { correct: true, name: 'option2' },
                { correct: true, name: 'option3' },
              ],
              randomized: false,
            },
            solution: {
              MC: [false, true, true],
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.MC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates FREE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test FREE',
            description: 'This is a simple FREE question.',
            type: 'FREE',
            options: {},
            solution: {
              FREE: 'This is true.',
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.FREE] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test FREE_RANGE',
            description: 'This is a simple FREE_RANGE question.',
            type: 'FREE_RANGE',
            options: {
              restrictions: { min: 0, max: 10 },
            },
            solution: {
              FREE_RANGE: 5,
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.FREE_RANGE] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates partly restricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test partly restricted FREE_RANGE',
            description: 'This is a simple partly restricted FREE_RANGE question.',
            type: 'FREE_RANGE',
            options: {
              restrictions: { min: 10, max: null },
            },
            solution: {
              FREE_RANGE: 15,
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions.FREE_RANGE_PART = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates unrestricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test unrestricted FREE_RANGE',
            description: 'This is a simple unrestricted FREE_RANGE question.',
            type: 'FREE_RANGE',
            options: {
              restrictions: { min: null, max: null },
            },
            solution: {
              FREE_RANGE: 20,
            },
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions.FREE_RANGE_OPEN = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })
  })

  describe('Question Modification', () => {
    it('modifies SC questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.SC,
            title: 'Test SC #2',
            description: 'This is a simple modified SC question.',
            options: {
              choices: [{ correct: true, name: 'option3' }, { correct: false, name: 'option4' }],
              randomized: false,
            },
            solution: {
              SC: [true, false],
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('modifies MC questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.MC,
            title: 'Test MC #2',
            description: 'This is a simple modified MC question.',
            options: {
              choices: [
                { correct: true, name: 'option3' },
                { correct: false, name: 'option4' },
                { correct: true, name: 'option5' },
              ],
              randomized: false,
            },
            solution: {
              MC: [true, false, true],
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('modifies FREE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.FREE,
            title: 'Test FREE #2',
            description: 'This is a simple modified FREE question.',
            options: {},
            solution: {
              FREE: 'New solution.',
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('modifies FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.FREE_RANGE,
            title: 'Test FREE_RANGE #2',
            description: 'This is a simple modified FREE_RANGE question.',
            options: {
              restrictions: { min: -10, max: 40 },
            },
            solution: {
              FREE_RANGE: 16,
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('modifies partly restricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.FREE_RANGE,
            title: 'Test FREE_RANGE #2',
            description: 'This is a simple modified FREE_RANGE question.',
            options: {
              restrictions: { min: null, max: 10 },
            },
            solution: {
              FREE_RANGE: 6,
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('modifies unrestricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ModifyQuestionMutation,
          variables: {
            id: questions.FREE_RANGE,
            title: 'Test FREE_RANGE #2',
            description: 'This is a simple modified FREE_RANGE question.',
            options: {
              restrictions: { min: null, max: null },
            },
            solution: {
              FREE_RANGE: 16,
            },
            tags: ['TestTag', 'AdditionalTag'],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })
  })

  describe('Session Creation', () => {
    it('works', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateSessionMutation,
          variables: {
            name: 'Session Name',
            blocks: [
              {
                questions: [
                  { question: questions[QuestionTypes.SC], version: 0 },
                  { question: questions[QuestionTypes.MC], version: 0 },
                ],
              },
              { questions: [{ question: questions[QuestionTypes.FREE], version: 0 }] },
              {
                questions: [
                  { question: questions[QuestionTypes.FREE_RANGE], version: 0 },
                  { question: questions.FREE_RANGE_PART, version: 0 },
                  { question: questions.FREE_RANGE_OPEN, version: 0 },
                ],
              },
            ],
          },
        },
        authCookie,
      ))

      sessionId = data.createSession.id

      expect(data).toMatchSnapshot()
    })
  })

  describe('Session Execution', () => {
    it('allows starting sessions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.StartSessionMutation,
          variables: { id: sessionId },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('allows updating session settings', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.UpdateSessionSettingsMutation,
          variables: {
            sessionId,
            settings: {
              isConfusionBarometerActive: true,
              isFeedbackChannelActive: true,
              isFeedbackChannelPublic: true,
            },
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('allows adding confusion timesteps', async () => {
      ensureNoErrors(await sendQuery({
        query: mutations.AddConfusionTSMutation,
        variables: {
          fp: 'myfp1',
          sessionId,
          difficulty: 2,
          speed: 4,
        },
      }))
      ensureNoErrors(await sendQuery({
        query: mutations.AddConfusionTSMutation,
        variables: {
          fp: 'myfp1',
          sessionId,
          difficulty: -2,
          speed: 3,
        },
      }))
      ensureNoErrors(await sendQuery({
        query: mutations.AddConfusionTSMutation,
        variables: {
          fp: 'myfp1',
          sessionId,
          difficulty: -5,
          speed: 3,
        },
      }))
      const data = ensureNoErrors(await sendQuery({
        query: mutations.AddConfusionTSMutation,
        variables: {
          fp: 'myfp1',
          sessionId,
          difficulty: 5,
          speed: 2,
        },
      }))

      expect(data).toMatchSnapshot()
    })

    it('allows adding feedbacks', async () => {
      ensureNoErrors(await sendQuery({
        query: mutations.AddFeedbackMutation,
        variables: { fp: 'myfp1', sessionId, content: 'my test feedback' },
      }))
      ensureNoErrors(await sendQuery({
        query: mutations.AddFeedbackMutation,
        variables: { fp: 'myfp1', sessionId, content: 'good lecture' },
      }))
      const data = ensureNoErrors(await sendQuery({
        query: mutations.AddFeedbackMutation,
        variables: { fp: 'myfp1', sessionId, content: 'my test feedback' },
      }))

      expect(data).toMatchSnapshot()
    })

    describe('allows running the full session flow (responding and evaluation)', () => {
      const instanceIds = {}

      it('LECTURER: can join the session initially', async () => {
        const runningSession = ensureNoErrors(await sendQuery(
          {
            query: queries.RunningSessionQuery,
          },
          authCookie,
        ))
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(await sendQuery(
          {
            query: queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie,
        ))
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can activate the first question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can join the session initially', async () => {
        const data = ensureNoErrors(await sendQuery({
          query: queries.JoinSessionQuery,
          variables: { shortname: 'integr' },
        }))

        instanceIds.SC = data.joinSession.activeQuestions[0].instanceId
        instanceIds.MC = data.joinSession.activeQuestions[1].instanceId

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the SC question in the first block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.SC,
            response: {
              choices: [0],
            },
          },
        }))
      })

      it('PARTICIPANT: can respond to the MC question in the first block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.MC,
            response: {
              choices: [0, 1],
            },
          },
        }))
      })

      it('LECTURER: can evaluate the first question block', async () => {
        const runningSession = ensureNoErrors(await sendQuery(
          {
            query: queries.RunningSessionQuery,
          },
          authCookie,
        ))
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(await sendQuery(
          {
            query: queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie,
        ))
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can close the first question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })

      // TODO: assertions

      it('LECTURER: can activate the second question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can update the joined session for the second block', async () => {
        const data = ensureNoErrors(await sendQuery({
          query: queries.JoinSessionQuery,
          variables: { shortname: 'integr' },
        }))

        instanceIds.FREE = data.joinSession.activeQuestions[0].instanceId

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.FREE,
            response: { value: 'hello world' },
          },
        }))
      })

      it('LECTURER: can evaluate the second question block', async () => {
        const runningSession = ensureNoErrors(await sendQuery(
          {
            query: queries.RunningSessionQuery,
          },
          authCookie,
        ))
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(await sendQuery(
          {
            query: queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie,
        ))
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can close the second question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })

      // TODO: assertions

      it('LECTURER: can activate the third question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can update the joined session for the third block', async () => {
        const data = ensureNoErrors(await sendQuery({
          query: queries.JoinSessionQuery,
          variables: { shortname: 'integr' },
        }))

        instanceIds.FREE_RANGE = data.joinSession.activeQuestions[0].instanceId
        instanceIds.FREE_RANGE_PART = data.joinSession.activeQuestions[1].instanceId
        instanceIds.FREE_RANGE_OPEN = data.joinSession.activeQuestions[2].instanceId

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the FREE_RANGE question in the third block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.FREE_RANGE,
            response: { value: 4 },
          },
        }))
      })

      it('PARTICIPANT: can respond to the partly restricted FREE_RANGE question in the third block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.FREE_RANGE_PART,
            response: { value: 99999 },
          },
        }))
      })

      it('PARTICIPANT: can respond to the unrestricted FREE_RANGE question in the third block', async () => {
        ensureNoErrors(await sendQuery({
          query: mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.FREE_RANGE_OPEN,
            response: { value: 99999.3784 },
          },
        }))
      })

      it('LECTURER: can evaluate the third question block', async () => {
        const runningSession = ensureNoErrors(await sendQuery(
          {
            query: queries.RunningSessionQuery,
          },
          authCookie,
        ))
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(await sendQuery(
          {
            query: queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie,
        ))
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can close the third question block', async () => {
        const data = ensureNoErrors(await sendQuery(
          {
            query: mutations.ActivateNextBlockMutation,
          },
          authCookie,
        ))

        expect(data).toMatchSnapshot()
      })
    })

    it('allows completing sessions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.EndSessionMutation,
          variables: { id: sessionId },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('allows evaluating sessions after completion', async () => {
      const evaluateSession = ensureNoErrors(await sendQuery(
        {
          query: queries.SessionEvaluationQuery,
          variables: { sessionId },
        },
        authCookie,
      ))

      expect(evaluateSession).toMatchSnapshot()
    })
  })

  describe('Question Archiving', () => {
    it('can archive questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ArchiveQuestionsMutation,
          variables: {
            ids: [questions.FREE_RANGE, questions.SC],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })

    it('can unarchive questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.ArchiveQuestionsMutation,
          variables: {
            ids: [questions.FREE_RANGE, questions.SC],
          },
        },
        authCookie,
      ))

      expect(data).toMatchSnapshot()
    })
  })
})
