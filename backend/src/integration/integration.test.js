const request = require('supertest')
const mongoose = require('mongoose')
const JWT = require('jsonwebtoken')

const Queries = require('./queries/index')
const Mutations = require('./mutations/index')
const AccountService = require('../services/accounts')
const { UserModel } = require('../models')
const { app } = require('../app')
const { initializeDb } = require('../lib/test/setup')
const { createContentState } = require('../lib/draft')
const { Errors, QUESTION_TYPES } = require('../constants')

process.env.NODE_ENV = 'test'

const serializers = [...Queries.serializers, ...Mutations.serializers]
serializers.forEach(serializer => expect.addSnapshotSerializer(serializer))

const initialPassword = 'somePassword'
const passwordAfterChange = 'someOtherPassword'

const sendQuery = (body, authCookie) => {
  if (authCookie) {
    return request(app)
      .post('/graphql')
      .set('Cookie', authCookie)
      .send(body)
  }

  return request(app)
    .post('/graphql')
    .send(body)
}

// ensure that there were no errors with the graphql request
const ensureNoErrors = (response, debug = false) => {
  if (debug) {
    console.log(response.body)
  }
  expect(response.body.data).toBeDefined()
  expect(response.body.errors).toBeUndefined()
  return response.body.data
}

describe('Integration', () => {
  let authCookie
  let sessionId
  let initialUserId
  let initialShortname
  const questions = {}

  beforeAll(async () => {
    ;({ userId: initialUserId, shortname: initialShortname } = await initializeDb({
      mongoose,
      email: 'testintegration@bf.uzh.ch',
      shortname: 'integr',
      isActive: false,
    }))
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await app.close()
    authCookie = null
  })

  const login = async password => {
    // send a login request
    const response = await sendQuery({
      query: Mutations.LoginMutation,
      variables: {
        email: 'testintegration@bf.uzh.ch',
        password,
      },
    })

    const data = ensureNoErrors(response)
    expect(data).toBeTruthy()

    // save the authorization cookie
    authCookie = response.header['set-cookie']
    expect(authCookie.length).toEqual(1)
  }

  describe('Account Activation', () => {
    it('prevents login to an inactive account', async () => {
      const { body } = await sendQuery({
        query: Mutations.LoginMutation,
        variables: { email: 'testintegration@bf.uzh.ch', password: initialPassword },
      })

      expect(body.errors[0].message).toEqual(Errors.ACCOUNT_NOT_ACTIVATED)
    })

    it('allows activation of an account with a valid activation token', async () => {
      const activationToken = AccountService.generateScopedToken(
        { id: initialUserId, shortname: initialShortname },
        'activate'
      )

      const { activateAccount } = ensureNoErrors(
        await sendQuery({
          query: Mutations.ActivateAccountMutation,
          variables: { activationToken },
        })
      )

      expect(activateAccount).toEqual('ACCOUNT_ACTIVATED')
    })
  })

  describe('Login', () => {
    it('works with valid credentials', async () => {
      await login(initialPassword)
    })
  })

  describe('Passwords', () => {
    it('can be updated', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ChangePasswordMutation,
            variables: { newPassword: passwordAfterChange },
          },
          authCookie
        )
      )
    })

    it('can be requested', async () => {
      ensureNoErrors(
        await sendQuery({
          query: Mutations.RequestPasswordMutation,
          variables: { email: 'testintegration@bf.uzh.ch' },
        })
      )
    })
  })

  describe('Account Data', () => {
    it('allows checking the availability of email addresses', async () => {
      expect(
        ensureNoErrors(
          await sendQuery({
            query: Queries.CheckAvailabilityQuery,
            variables: { email: 'testintegration@bf.uzh.ch' },
          })
        )
      ).toMatchObject({
        checkAvailability: {
          email: false,
          shortname: null,
        },
      })

      expect(
        ensureNoErrors(
          await sendQuery({
            query: Queries.CheckAvailabilityQuery,
            variables: { email: 'doesnotexist@bf.uzh.ch' },
          })
        )
      ).toMatchObject({
        checkAvailability: {
          email: true,
          shortname: null,
        },
      })
    })

    it('allows checking the availability of shortnames', async () => {
      expect(
        ensureNoErrors(
          await sendQuery({
            query: Queries.CheckAvailabilityQuery,
            variables: { shortname: 'integr' },
          })
        )
      ).toMatchObject({
        checkAvailability: {
          shortname: false,
          email: null,
        },
      })

      expect(
        ensureNoErrors(
          await sendQuery({
            query: Queries.CheckAvailabilityQuery,
            variables: { shortname: 'nonexist' },
          })
        )
      ).toMatchObject({
        checkAvailability: {
          shortname: true,
          email: null,
        },
      })
    })

    it('can be updated', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyUserMutation,
            variables: { institution: 'integrator', useCase: 'integration' },
          },
          authCookie
        )
      )

      expect(data).toMatchObject({
        modifyUser: {
          institution: 'integrator',
          useCase: 'integration',
        },
      })
    })
  })

  describe('Question Creation', () => {
    it('creates SC questions', async () => {
      const questionContent = 'This is a simple SC question.'
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test SC',
              content: createContentState(questionContent),
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
          authCookie
        )
      )

      questions[QUESTION_TYPES.SC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates MC questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test MC',
              content: createContentState('This is a simple MC question.'),
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
          authCookie
        )
      )

      questions[QUESTION_TYPES.MC] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates FREE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test FREE',
              content: createContentState('This is a simple FREE question.'),
              type: 'FREE',
              options: {},
              solution: {
                FREE: 'This is true.',
              },
              tags: ['TestTag'],
            },
          },
          authCookie
        )
      )

      questions[QUESTION_TYPES.FREE] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test FREE_RANGE',
              content: createContentState('This is a simple FREE_RANGE question.'),
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
          authCookie
        )
      )

      questions[QUESTION_TYPES.FREE_RANGE] = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates partly restricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test partly restricted FREE_RANGE',
              content: createContentState('This is a simple partly restricted FREE_RANGE question.'),
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
          authCookie
        )
      )

      questions.FREE_RANGE_PART = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })

    it('creates unrestricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateQuestionMutation,
            variables: {
              title: 'Test unrestricted FREE_RANGE',
              content: createContentState('This is a simple unrestricted FREE_RANGE question.'),
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
          authCookie
        )
      )

      questions.FREE_RANGE_OPEN = data.createQuestion.id

      expect(data).toMatchSnapshot()
    })
  })

  describe('Question Modification', () => {
    it('modifies SC questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.SC,
              title: 'Test SC #2',
              content: createContentState('This is a simple modified SC question.'),
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
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('modifies MC questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.MC,
              title: 'Test MC #2',
              content: createContentState('This is a simple modified MC question.'),
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
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('modifies FREE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.FREE,
              title: 'Test FREE #2',
              content: createContentState('This is a simple modified FREE question.'),
              options: {},
              solution: {
                FREE: 'New solution.',
              },
              tags: ['TestTag', 'AdditionalTag'],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('modifies FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.FREE_RANGE,
              title: 'Test FREE_RANGE #2',
              content: createContentState('This is a simple modified FREE_RANGE question.'),
              options: {
                restrictions: { min: -10, max: 40 },
              },
              solution: {
                FREE_RANGE: 16,
              },
              tags: ['TestTag', 'AdditionalTag'],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('modifies partly restricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.FREE_RANGE,
              title: 'Test FREE_RANGE #2',
              content: createContentState('This is a simple modified FREE_RANGE question.'),
              options: {
                restrictions: { min: null, max: 10 },
              },
              solution: {
                FREE_RANGE: 6,
              },
              tags: ['TestTag', 'AdditionalTag'],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('modifies unrestricted FREE_RANGE questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionMutation,
            variables: {
              id: questions.FREE_RANGE,
              title: 'Test FREE_RANGE #2',
              content: createContentState('This is a simple modified FREE_RANGE question.'),
              options: {
                restrictions: { min: null, max: null },
              },
              solution: {
                FREE_RANGE: 16,
              },
              tags: ['TestTag', 'AdditionalTag'],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })
  })

  describe('Session Management', () => {
    it('enables the creation of a new session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateSessionMutation,
            variables: {
              name: 'Session Name',
              blocks: [
                {
                  questions: [
                    { question: questions[QUESTION_TYPES.SC], version: 0 },
                    { question: questions[QUESTION_TYPES.MC], version: 0 },
                  ],
                },
                {
                  questions: [{ question: questions[QUESTION_TYPES.FREE], version: 0 }],
                },
                {
                  questions: [
                    {
                      question: questions[QUESTION_TYPES.FREE_RANGE],
                      version: 0,
                    },
                    { question: questions.FREE_RANGE_PART, version: 0 },
                    { question: questions.FREE_RANGE_OPEN, version: 0 },
                  ],
                },
              ],
            },
          },
          authCookie
        )
      )

      sessionId = data.createSession.id

      expect(data).toMatchSnapshot()
    })

    it('enables modifications on the created session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifySessionMutation,
            variables: {
              id: sessionId,
              name: 'Updated Session Name',
              blocks: [
                {
                  questions: [
                    { question: questions[QUESTION_TYPES.SC], version: 0 },
                    { question: questions[QUESTION_TYPES.MC], version: 0 },
                  ],
                },
                {
                  questions: [{ question: questions[QUESTION_TYPES.FREE], version: 0 }],
                },
                {
                  questions: [
                    {
                      question: questions[QUESTION_TYPES.FREE_RANGE],
                      version: 0,
                    },
                    { question: questions.FREE_RANGE_PART, version: 0 },
                    { question: questions.FREE_RANGE_OPEN, version: 0 },
                  ],
                },
                {
                  questions: [
                    { question: questions[QUESTION_TYPES.MC], version: 0 },
                    { question: questions[QUESTION_TYPES.SC], version: 0 },
                  ],
                },
              ],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })
  })

  describe('Session Execution', () => {
    it('allows starting sessions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionId },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('allows updating session settings', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.UpdateSessionSettingsMutation,
            variables: {
              sessionId,
              settings: {
                isConfusionBarometerActive: true,
                isFeedbackChannelActive: true,
                isFeedbackChannelPublic: true,
              },
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('allows adding confusion timesteps', async () => {
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddConfusionTSMutation,
          variables: {
            fp: 'myfp1',
            sessionId,
            difficulty: 2,
            speed: 4,
          },
        })
      )
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddConfusionTSMutation,
          variables: {
            fp: 'myfp1',
            sessionId,
            difficulty: -2,
            speed: 3,
          },
        })
      )
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddConfusionTSMutation,
          variables: {
            fp: 'myfp1',
            sessionId,
            difficulty: -5,
            speed: 3,
          },
        })
      )
      const data = ensureNoErrors(
        await sendQuery({
          query: Mutations.AddConfusionTSMutation,
          variables: {
            fp: 'myfp1',
            sessionId,
            difficulty: 5,
            speed: 2,
          },
        })
      )

      expect(data).toMatchSnapshot()
    })

    it('allows adding feedbacks', async () => {
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddFeedbackMutation,
          variables: { fp: 'myfp1', sessionId, content: 'my test feedback' },
        })
      )
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddFeedbackMutation,
          variables: { fp: 'myfp1', sessionId, content: 'good lecture' },
        })
      )
      const data = ensureNoErrors(
        await sendQuery({
          query: Mutations.AddFeedbackMutation,
          variables: { fp: 'myfp1', sessionId, content: 'my test feedback' },
        })
      )

      expect(data).toMatchSnapshot()
    })

    describe('allows running the full session flow (responding and evaluation)', () => {
      const instanceIds = {}

      it('LECTURER: can join the session initially', async () => {
        const runningSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.RunningSessionQuery,
            },
            authCookie
          )
        )
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.SessionEvaluationQuery,
              variables: { sessionId },
            },
            authCookie
          )
        )
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can activate the first question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can join the session initially', async () => {
        const data = ensureNoErrors(
          await sendQuery({
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          })
        )

        instanceIds.SC = data.joinSession.activeInstances[0].id
        instanceIds.MC = data.joinSession.activeInstances[1].id

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the SC question in the first block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.SC,
              response: {
                choices: [0],
              },
            },
          })
        )
      })

      it('PARTICIPANT: can respond to the MC question in the first block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.MC,
              response: {
                choices: [0, 1],
              },
            },
          })
        )
      })

      it('LECTURER: can evaluate the first question block', async () => {
        const runningSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.RunningSessionQuery,
            },
            authCookie
          )
        )
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.SessionEvaluationQuery,
              variables: { sessionId },
            },
            authCookie
          )
        )
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can pause the session', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.PauseSessionMutation,
              variables: { id: sessionId },
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      it('LECTURER: can continue the session', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.StartSessionMutation,
              variables: { id: sessionId },
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      it('LECTURER: can close the first question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      // TODO: assertions

      it('LECTURER: can activate the second question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can update the joined session for the second block', async () => {
        const data = ensureNoErrors(
          await sendQuery({
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          })
        )

        instanceIds.FREE = data.joinSession.activeInstances[0].id

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          })
        )
      })

      it('LECTURER: can evaluate the second question block', async () => {
        const runningSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.RunningSessionQuery,
            },
            authCookie
          )
        )
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.SessionEvaluationQuery,
              variables: { sessionId },
            },
            authCookie
          )
        )
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can close the second question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      // TODO: assertions

      it('LECTURER: can activate the third question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can update the joined session for the third block', async () => {
        const data = ensureNoErrors(
          await sendQuery({
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          })
        )

        instanceIds.FREE_RANGE = data.joinSession.activeInstances[0].id
        instanceIds.FREE_RANGE_PART = data.joinSession.activeInstances[1].id
        instanceIds.FREE_RANGE_OPEN = data.joinSession.activeInstances[2].id

        expect(data).toMatchSnapshot()
      })

      it('PARTICIPANT: can respond to the FREE_RANGE question in the third block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE,
              response: { value: '4' },
            },
          })
        )
      })

      it('PARTICIPANT: can respond to the partly restricted FREE_RANGE question in the third block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE_PART,
              response: { value: '99999' },
            },
          })
        )
      })

      it('PARTICIPANT: can respond to the unrestricted FREE_RANGE question in the third block', async () => {
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE_OPEN,
              response: { value: '99999.3784' },
            },
          })
        )
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE_OPEN,
              response: { value: '50000' },
            },
          })
        )
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE_OPEN,
              response: { value: '50000' },
            },
          })
        )
        ensureNoErrors(
          await sendQuery({
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE_RANGE_OPEN,
              response: { value: '20000' },
            },
          })
        )
      })

      it('LECTURER: can evaluate the third question block', async () => {
        const runningSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.RunningSessionQuery,
            },
            authCookie
          )
        )
        expect(runningSession).toMatchSnapshot()

        const evaluateSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.SessionEvaluationQuery,
              variables: { sessionId },
            },
            authCookie
          )
        )
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can remove responses from questions', async () => {
        const { deleteResponse } = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.DeleteResponseMutation,
              variables: {
                instanceId: instanceIds.FREE_RANGE_OPEN,
                response: '20000',
              },
            },
            authCookie
          )
        )
        expect(deleteResponse).toEqual('RESPONSE_DELETED')

        const evaluateSession = ensureNoErrors(
          await sendQuery(
            {
              query: Queries.SessionEvaluationQuery,
              variables: { sessionId },
            },
            authCookie
          )
        )
        expect(evaluateSession).toMatchSnapshot()
      })

      it('LECTURER: can close the third question block', async () => {
        const data = ensureNoErrors(
          await sendQuery(
            {
              query: Mutations.ActivateNextBlockMutation,
            },
            authCookie
          )
        )

        expect(data).toMatchSnapshot()
      })
    })

    it('allows publishing session evaluations', async () => {
      // ensure that the session evaluation data is not leaked before publishing
      const privateSessionData = ensureNoErrors(
        await sendQuery({
          query: Queries.SessionPublicEvaluationQuery,
          variables: {
            sessionId,
          },
        })
      )

      expect(privateSessionData.sessionPublic).toBeFalsy()

      // set the session evaluation to be publicly available
      await sendQuery(
        {
          query: Mutations.UpdateSessionSettingsMutation,
          variables: {
            sessionId,
            settings: {
              isEvaluationPublic: true,
            },
          },
        },
        authCookie
      )

      // ensure that the evaluation can be publicly accessed (but only in restricted format)
      const publicSessionData = ensureNoErrors(
        await sendQuery({
          query: Queries.SessionPublicEvaluationQuery,
          variables: {
            sessionId,
          },
        })
      )

      expect(publicSessionData).toMatchSnapshot()
    })

    it('allows completing sessions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.EndSessionMutation,
            variables: { id: sessionId },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('allows evaluating sessions after completion', async () => {
      const evaluateSession = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie
        )
      )

      expect(evaluateSession).toMatchSnapshot()
    })
  })

  describe('Question Archiving', () => {
    it('can archive questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ArchiveQuestionsMutation,
            variables: {
              ids: [questions.FREE_RANGE, questions.SC],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('can unarchive questions', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ArchiveQuestionsMutation,
            variables: {
              ids: [questions.FREE_RANGE, questions.SC],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })
  })

  describe('Entity Deletion', () => {
    it('allows deletion of sessions', async () => {
      const { deleteSessions } = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.DeleteSessionsMutation,
            variables: {
              ids: [sessionId],
            },
          },
          authCookie
        )
      )

      expect(deleteSessions).toEqual('DELETION_SUCCESSFUL')
    })

    it('allows deletion of questions', async () => {
      const { deleteQuestions } = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.DeleteQuestionsMutation,
            variables: {
              ids: [questions.FREE_RANGE, questions.MC],
            },
          },
          authCookie
        )
      )

      expect(deleteQuestions).toEqual('DELETION_SUCCESSFUL')
    })
  })

  describe('Logout', () => {
    it('works', async () => {
      const response = await sendQuery(
        {
          query: Mutations.LogoutMutation,
        },
        authCookie
      )

      const data = ensureNoErrors(response)
      expect(data).toMatchSnapshot()

      // save the authorization cookie
      authCookie = response.header['set-cookie']
      expect(authCookie.length).toEqual(1)

      // try to archive questions (should not work)
      const response2 = await sendQuery(
        {
          query: Mutations.ArchiveQuestionsMutation,
          variables: {
            ids: [questions.FREE_RANGE, questions.SC],
          },
        },
        authCookie
      )

      // expect the response to contain "INVALID_LOGIN"
      // expect(response2.body.errors).toMatchSnapshot()
      expect(response2.body.errors[0].message).toEqual('INVALID_LOGIN')
    })
  })

  describe('Account Deletion', () => {
    beforeAll(async () => {
      await login(passwordAfterChange)
    })

    it('can request a deletion token email', async () => {
      const { requestAccountDeletion } = ensureNoErrors(
        await sendQuery({ query: Mutations.RequestAccountDeletionMutation }, authCookie)
      )
      expect(requestAccountDeletion).toEqual('ACCOUNT_DELETION_EMAIL_SENT')
    })

    it('can perform a full account deletion', async () => {
      // extract the jwt from the authCookie
      const jwt = authCookie[0].split(';')[0].split('=')[1]

      // decode the authentication cookie
      const { sub, shortname } = JWT.decode(jwt)

      // precompute a valid deletion token
      const deletionToken = AccountService.generateScopedToken({ id: sub, shortname }, 'delete')

      // perform account deletion
      const { resolveAccountDeletion } = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ResolveAccountDeletionMutation,
            variables: { deletionToken },
          },
          authCookie
        )
      )
      expect(resolveAccountDeletion).toEqual('ACCOUNT_DELETED')

      // verify that the user has been deleted
      expect(await UserModel.count({ id: sub })).toEqual(0)
    })
  })
})
