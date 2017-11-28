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
      expect(data).toMatchSnapshot()

      // save the authorization cookie
      authCookie = response.header['set-cookie']
      expect(authCookie.length).toEqual(1)
    })
  })

  describe('Question Creation', () => {
    it('works for SC questions', async () => {
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
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.SC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('works for MC questions', async () => {
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
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.MC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('works for FREE questions', async () => {
      const data = ensureNoErrors(await sendQuery(
        {
          query: mutations.CreateQuestionMutation,
          variables: {
            title: 'Test FREE',
            description: 'This is a simple FREE question.',
            type: 'FREE',
            options: {},
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.FREE] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('works for FREE_RANGE questions', async () => {
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
            tags: ['TestTag'],
          },
        },
        authCookie,
      ))

      questions[QuestionTypes.FREE_RANGE] = data.createQuestion.id

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
              { questions: [questions[QuestionTypes.SC], questions[QuestionTypes.MC]] },
              { questions: [questions[QuestionTypes.FREE]] },
              { questions: [questions[QuestionTypes.FREE_RANGE]] },
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
          speed: 9,
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
          speed: 10,
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
})
