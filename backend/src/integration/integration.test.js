const request = require('supertest')
const mongoose = require('mongoose')
const JWT = require('jsonwebtoken')
const { map } = require('ramda')

const Queries = require('./queries/index')
const Mutations = require('./mutations/index')
const AccountService = require('../services/accounts')
const { UserModel } = require('../models')
const { app } = require('../app')
const { initializeDb } = require('../lib/test/setup')
const { createContentState } = require('../lib/draft')
const { Errors, QUESTION_TYPES, SESSION_STORAGE_MODE, SESSION_AUTHENTICATION_MODE, ROLES } = require('../constants')
const { getRedis } = require('../redis')

process.env.NODE_ENV = 'test'

const serializers = [...Queries.serializers, ...Mutations.serializers]
serializers.forEach((serializer) => expect.addSnapshotSerializer(serializer))

const initialPassword = 'somePassword'
const passwordAfterChange = 'someOtherPassword'

const responseCache = getRedis()

const sendQuery = (body, authCookie) => {
  if (authCookie) {
    return request(app).post('/graphql').set('Cookie', authCookie).send(body)
  }

  return request(app).post('/graphql').send(body)
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

const isUuidValid = (value) => {
  if (typeof value === 'string' && (value.length === 24 || value.length === 36)) {
    return 'UUID_VALID'
  }
  return 'UUID_INVALID'
}

const REDIS_TYPES = {
  LIST: 'LIST',
  HASH: 'HASH',
  SET: 'SET',
}
const REDIS_KEY_TYPES = {
  dropped: REDIS_TYPES.LIST,
  fp: REDIS_TYPES.SET,
  info: REDIS_TYPES.HASH,
  ip: REDIS_TYPES.SET,
  participants: REDIS_TYPES.SET,
  participantList: REDIS_TYPES.SET,
  responseHashes: REDIS_TYPES.HASH,
  responses: REDIS_TYPES.LIST,
  results: REDIS_TYPES.HASH,
}
const ensureCacheConsistency = async (questionBlock, { expectedKeys, unexpectedKeys } = {}) => {
  const instanceResults = await Promise.all(
    questionBlock.instances.map(async ({ id }) => {
      const instanceKey = `instance:${id}`

      // ensure that we have the expected number of keys
      const newKeys = await responseCache.keys(`${instanceKey}:*`)
      if (unexpectedKeys) {
        unexpectedKeys.forEach((key) => expect(newKeys.includes(`${instanceKey}:${key}`)).toBeFalsy())
      }
      if (expectedKeys) {
        expect(newKeys.map((key) => key.split(':')[2])).toEqual(expect.arrayContaining(expectedKeys))
        if (expectedKeys.length === 0) {
          expect(newKeys).toHaveLength(0)
        }
      }
      if (newKeys.length === 0) {
        return null
      }

      // extract data from the cache
      const data = {}
      await Promise.all(
        newKeys.map(async (dataKey) => {
          const key = dataKey.split(':')[2]
          switch (REDIS_KEY_TYPES[key]) {
            case REDIS_TYPES.HASH:
              data[key] = await responseCache.hgetall(`${instanceKey}:${key}`)
              if (typeof data[key] !== 'undefined' && typeof data[key].namespace !== 'undefined') {
                data[key].namespace = isUuidValid(data[key].namespace)
              }
              break
            case REDIS_TYPES.LIST: {
              const listItems = await responseCache.lrange(`${instanceKey}:${key}`, 0, -1)
              if (['responses', 'dropped'].includes(key)) {
                data[key] = map((response) => {
                  const json = JSON.parse(response)
                  return { ...json, participant: isUuidValid(json.participant) }
                }, listItems)
              } else {
                data[key] = listItems
              }
              break
            }

            case REDIS_TYPES.SET: {
              const setMembers = await responseCache.smembers(`${instanceKey}:${key}`)
              if (['participants', 'participantList'].includes(key)) {
                data[key] = map(isUuidValid, setMembers)
              } else {
                data[key] = setMembers
              }

              break
            }

            default:
          }
        })
      )
      return data
    })
  )
  return instanceResults.filter((result) => !!result)
}

describe('Integration', () => {
  let authCookie
  let adminAuthCookie
  let authCookieParticipant
  let sessionId
  let sessionIdWithAuth
  // let sessionIdCompleteWithAuth
  let initialUserId
  let initialDummyId
  let initialShortname
  let blocks
  let blockIds
  let participantCredentials
  const questions = {}

  beforeAll(async () => {
    ;({
      userId: initialUserId,
      dummyId: initialDummyId,
      shortname: initialShortname,
    } = await initializeDb({
      mongoose,
      email: 'testintegration@bf.uzh.ch',
      shortname: 'integr',
      isActive: false,
      withAdmin: true,
    }))
  })

  afterAll(async (done) => {
    authCookie = null
    adminAuthCookie = null
    await mongoose.disconnect(done)
  })

  const login = async (password) => {
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

  const loginAsAdmin = async (password) => {
    // send a login request
    const response = await sendQuery({
      query: Mutations.LoginMutation,
      variables: {
        email: 'admin@bf.uzh.ch',
        password,
      },
    })

    const data = ensureNoErrors(response)
    expect(data).toBeTruthy()

    // save the authorization cookie
    adminAuthCookie = response.header['set-cookie']
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
                choices: [
                  { correct: false, name: 'option1' },
                  { correct: true, name: 'option2' },
                ],
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
                choices: [
                  { correct: true, name: 'option3' },
                  { correct: false, name: 'option4' },
                ],
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

      blocks = data.modifySession.blocks
      blockIds = data.modifySession.blocks.map((block) => block.id)
    })
  })

  describe('Session Execution', () => {
    const instanceIds = {}

    it('LECTURER: can start a session', async () => {
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

    it('LECTURER: can update session settings', async () => {
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

    it('PARTICIPANT: can add confusion timesteps', async () => {
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

    it('PARTICIPANT: can add feedbacks', async () => {
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

    it('LECTURER: can join the session initially (initial)', async () => {
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

    it('LECTURER: can activate the first question block (initial)', async () => {
      ensureCacheConsistency(blocks[0], { expectedKeys: [] })

      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateNextBlockMutation,
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: ['info', 'results'] })).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can join the session initially (initial)', async () => {
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

    it('PARTICIPANT: can respond to the SC question in the first block (initial)', async () => {
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

      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('LECTURER: can cancel the running session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CancelSessionMutation,
            variables: {
              id: sessionId,
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that everything has been purged from the cache
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can restart the cancelled session', async () => {
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

      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can update settings of the restarted session', async () => {
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

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
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

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
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

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "1",
              "1": "1",
              "2": "0",
              "participants": "1",
            },
          },
        ]
      `)
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
      expect(runningSession).toMatchSnapshot('running')

      const evaluateSession = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie
        )
      )
      expect(evaluateSession).toMatchSnapshot('evaluate')
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

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
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

      // ensure that the response cache has been rehydrated from the database results
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "results": Object {
              "0": "1",
              "1": "1",
              "2": "0",
              "participants": "1",
            },
          },
        ]
      `)
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

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

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

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
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

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
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
      expect(runningSession).toMatchSnapshot('running')

      const evaluateSession = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie
        )
      )
      expect(evaluateSession).toMatchSnapshot('evaluate')
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

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can change the settings of the third question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyQuestionBlockMutation,
            variables: {
              id: blockIds[2],
              sessionId,
              timeLimit: 60,
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

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

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[2])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "max": "10",
              "min": "0",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "10",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
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

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[2])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "max": "10",
              "min": "0",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "4",
            },
            "results": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "10",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
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

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[2])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "max": "10",
              "min": "0",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "4",
            },
            "results": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "10",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "99999",
            },
            "results": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
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
            response: { value: '0' },
          },
        })
      )
      ensureNoErrors(
        await sendQuery({
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.FREE_RANGE_OPEN,
            response: { value: '-10.344' },
          },
        })
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[2])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "max": "10",
              "min": "0",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "4",
            },
            "results": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "10",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "99999",
            },
            "results": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "1017bfd4673955ffee4641ad3d481b1c": "50000",
              "177b84641c41559c3c2f24c2ae749816": "-10.344",
              "cfcd208495d565ef66e7dff9f98764da": "0",
              "e4b1fc5758fb519823c9f2feb30b9a87": "99999.3784",
            },
            "results": Object {
              "1017bfd4673955ffee4641ad3d481b1c": "2",
              "177b84641c41559c3c2f24c2ae749816": "1",
              "cfcd208495d565ef66e7dff9f98764da": "1",
              "e4b1fc5758fb519823c9f2feb30b9a87": "1",
              "participants": "5",
            },
          },
        ]
      `)
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
      expect(runningSession).toMatchSnapshot('running')

      const evaluateSession = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.SessionEvaluationQuery,
            variables: { sessionId },
          },
          authCookie
        )
      )
      expect(evaluateSession).toMatchSnapshot('evaluate')
    })

    it('LECTURER: can remove responses from questions', async () => {
      const { deleteResponse } = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.DeleteResponseMutation,
            variables: {
              instanceId: instanceIds.FREE_RANGE_OPEN,
              response: '50000',
            },
          },
          authCookie
        )
      )
      expect(deleteResponse).toEqual('RESPONSE_DELETED')

      // ensure that the response has been removed from the response cache
      expect(ensureCacheConsistency(blocks[2])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "false",
              "max": "10",
              "min": "0",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "4",
            },
            "results": Object {
              "a87ff679a2f3e71d9181a67b7542122c": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "10",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "99999",
            },
            "results": Object {
              "d3eb9a9233e52948740d7eb8c3062d14": "1",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "false",
              "max": "",
              "min": "",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE_RANGE",
            },
            "responseHashes": Object {
              "1017bfd4673955ffee4641ad3d481b1c": "50000",
              "177b84641c41559c3c2f24c2ae749816": "-10.344",
              "cfcd208495d565ef66e7dff9f98764da": "0",
              "e4b1fc5758fb519823c9f2feb30b9a87": "99999.3784",
            },
            "results": Object {
              "177b84641c41559c3c2f24c2ae749816": "1",
              "cfcd208495d565ef66e7dff9f98764da": "1",
              "e4b1fc5758fb519823c9f2feb30b9a87": "1",
              "participants": "3",
            },
          },
        ]
      `)

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

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[2], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
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

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[2], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
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

  describe('Question Statistics', () => {
    it('can load question statistics for all question types', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.QuestionStatisticsMutation,
            variables: {
              ids: [questions.SC, questions.MC, questions.FREE, questions.FREE_RANGE],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
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

  describe('Session Management (authenticated)', () => {
    it('enables the creation of a new session)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateSessionMutation,
            variables: {
              name: 'Session Name (auth)',
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
              participants: [{ username: 'integration-1' }],
              authenticationMode: SESSION_AUTHENTICATION_MODE.NONE,
              storageMode: SESSION_STORAGE_MODE.SECRET,
            },
          },
          authCookie
        )
      )

      sessionIdWithAuth = data.createSession.id

      expect(data).toMatchSnapshot()
    })

    it('enables modifications on the created session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifySessionMutation,
            variables: {
              id: sessionIdWithAuth,
              name: 'Updated Session Name (auth)',
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
              participants: [{ username: 'integration-2' }, { username: 'integration-3' }],
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      blocks = data.modifySession.blocks
      blockIds = data.modifySession.blocks.map((block) => block.id)
      participantCredentials = data.modifySession.participants
    })
  })

  describe('Session Execution (authenticated)', () => {
    const instanceIds = {}

    it('LECTURER: can start a session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
    })

    it('LECTURER: can activate the first question block (initial)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateNextBlockMutation,
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can login to the session', async () => {
      // send a login request
      const response = await sendQuery({
        query: Mutations.LoginParticipantMutation,
        variables: {
          sessionId: sessionIdWithAuth,
          username: participantCredentials[0].username,
          password: participantCredentials[0].password,
        },
      })

      const data = ensureNoErrors(response)
      expect(data).toBeTruthy()

      // save the authorization cookie
      authCookieParticipant = response.header['set-cookie']
      expect(authCookieParticipant.length).toEqual(1)
    })

    it('PARTICIPANT: can join the session initially (initial)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          },
          authCookieParticipant
        )
      )

      instanceIds.SC = data.joinSession.activeInstances[0].id
      instanceIds.MC = data.joinSession.activeInstances[1].id

      expect(data).toMatchSnapshot()
    })

    it('PARTICIPANT: can respond to the SC question in the first block (initial)', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.SC,
              response: {
                choices: [0],
              },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0], { unexpectedKeys: ['responses'] })).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
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
      expect(runningSession).toMatchSnapshot('running')

      const evaluateSession = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.SessionEvaluationQuery,
            variables: { sessionId: sessionIdWithAuth },
          },
          authCookie
        )
      )
      expect(evaluateSession).toMatchSnapshot('evaluate')
    })

    it('LECTURER: can pause the session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.PauseSessionMutation,
            variables: { id: sessionIdWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can continue the session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that the response cache has been rehydrated from the database results
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: is unable to respond again after session pause & continue', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.SC,
            response: {
              choices: [1],
            },
          },
        },
        authCookieParticipant
      )

      expect(response.body.errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "extensions": Object {
              "code": "FORBIDDEN",
            },
            "locations": Array [
              Object {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "RESPONSE_NOT_ALLOWED",
            "path": Array [
              "addResponse",
            ],
          },
        ]
      `)
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

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

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

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[1], { unexpectedKeys: ['responses'] })).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can update the joined session for the second block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          },
          authCookieParticipant
        )
      )

      instanceIds.FREE = data.joinSession.activeInstances[0].id

      expect(data).toMatchSnapshot()
    })

    it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'participants', 'responseHashes', 'results'],
          unexpectedKeys: ['responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: is unable to respond to the FREE question a second time', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp2',
            instanceId: instanceIds.FREE,
            response: { value: 'hello different world' },
          },
        },
        authCookieParticipant
      )

      expect(response.body.errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "extensions": Object {
              "code": "FORBIDDEN",
            },
            "locations": Array [
              Object {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "RESPONSE_NOT_ALLOWED",
            "path": Array [
              "addResponse",
            ],
          },
        ]
      `)

      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'participants', 'responseHashes', 'results'],
          unexpectedKeys: ['responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can cancel the running session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CancelSessionMutation,
            variables: {
              id: sessionIdWithAuth,
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that everything has been purged from the cache
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can start the session again', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that everything has been purged from the cache
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can jump directly to the second question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'participants', 'responseHashes', 'results'],
          unexpectedKeys: ['responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can jump directly to the first question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdWithAuth, blockId: blocks[0].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('PARTICIPANT: can respond to the MC question in the first block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.MC,
              response: {
                choices: [1, 2],
              },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "1",
              "2": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can jump back to the second question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: is unable to respond to the FREE question a second time', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp2',
            instanceId: instanceIds.FREE,
            response: { value: 'hello different world' },
          },
        },
        authCookieParticipant
      )

      expect(response.body.errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "extensions": Object {
              "code": "FORBIDDEN",
            },
            "locations": Array [
              Object {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "RESPONSE_NOT_ALLOWED",
            "path": Array [
              "addResponse",
            ],
          },
        ]
      `)

      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'participants', 'responseHashes', 'results'],
          unexpectedKeys: ['responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can reset the results of the second question block (current)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ResetQuestionBlockMutation,
            variables: { sessionId: sessionIdWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'results'],
          unexpectedKeys: ['participants', 'responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'participants', 'responseHashes', 'results'],
          unexpectedKeys: ['responses'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "SECRET",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can cancel the running session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CancelSessionMutation,
            variables: {
              id: sessionIdWithAuth,
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that everything has been purged from the cache
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })
  })

  /* Currently unnused since storageMode: 'COMPLETE' is disabled

  describe('Session Management (authenticated, complete)', () => {
    it('enables the creation of a new session)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateSessionMutation,
            variables: {
              name: 'Session Name (auth & complete)',
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
              participants: [{ username: 'integration-1' }, { username: 'tester-1' }, { username: 'aai-1' }],
              authenticationMode: SESSION_AUTHENTICATION_MODE.PASSWORD,
              storageMode: SESSION_STORAGE_MODE.COMPLETE,
            },
          },
          authCookie
        )
      )

      sessionIdCompleteWithAuth = data.createSession.id
      blocks = data.createSession.blocks
      blockIds = data.createSession.blocks.map((block) => block.id)
      participantCredentials = data.createSession.participants

      expect(data).toMatchSnapshot()
    })
  })

  describe('Session Execution (authenticated, complete)', () => {
    const instanceIds = {}

    it('LECTURER: can start a session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdCompleteWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()
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

      // ensure that the question instances are initialized in the response cache
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can login to the session', async () => {
      // send a login request
      const response = await sendQuery({
        query: Mutations.LoginParticipantMutation,
        variables: {
          sessionId: sessionIdCompleteWithAuth,
          username: participantCredentials[1].username,
          password: participantCredentials[1].password,
        },
      })

      const data = ensureNoErrors(response)
      expect(data).toBeTruthy()

      // save the authorization cookie
      authCookieParticipant = response.header['set-cookie']
      expect(authCookieParticipant.length).toEqual(1)
    })

    it('PARTICIPANT: can join the session initially', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          },
          authCookieParticipant
        )
      )

      instanceIds.SC = data.joinSession.activeInstances[0].id
      instanceIds.MC = data.joinSession.activeInstances[1].id

      expect(data).toMatchSnapshot()
    })

    it('PARTICIPANT: can respond to the SC question in the first block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.SC,
              response: {
                choices: [0],
              },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    0,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can respond to the MC question in the first block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.MC,
              response: {
                choices: [1, 2],
              },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: ['responses'] })).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    0,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                    2,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "0",
              "1": "1",
              "2": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: cannot respond to the SC question again', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp1',
            instanceId: instanceIds.SC,
            response: {
              choices: [1],
            },
          },
        },
        authCookieParticipant
      )

      expect(response.body.errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "extensions": Object {
              "code": "FORBIDDEN",
            },
            "locations": Array [
              Object {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "RESPONSE_NOT_ALLOWED",
            "path": Array [
              "addResponse",
            ],
          },
        ]
      `)

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "dropped": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                  ],
                },
              },
            ],
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    0,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                    2,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "0",
              "1": "1",
              "2": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can pause the session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.PauseSessionMutation,
            variables: { id: sessionIdCompleteWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // TODO: ensure that the results have been persisted to the database

      // ensure that the response cache has been cleaned up
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can continue the session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdCompleteWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that the response cache has been rehydrated from the database results
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "dropped": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                  ],
                },
              },
            ],
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    0,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "1",
              "1": "0",
              "participants": "1",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                    2,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "0",
              "1": "1",
              "2": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can cancel the running session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CancelSessionMutation,
            variables: {
              id: sessionIdCompleteWithAuth,
            },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      // ensure that everything has been purged from the cache
      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can restart the cancelled session', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionIdCompleteWithAuth },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('LECTURER: can jump directly to the second question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdCompleteWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can update the joined session for the second block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.JoinSessionQuery,
            variables: { shortname: 'integr' },
          },
          authCookieParticipant
        )
      )

      instanceIds.FREE = data.joinSession.activeInstances[0].id

      expect(data).toMatchSnapshot()
    })

    it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
            ],
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can jump directly to the first question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdCompleteWithAuth, blockId: blocks[0].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "2": "0",
              "participants": "0",
            },
          },
        ]
      `)
      expect(ensureCacheConsistency(blocks[1], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
    })

    it('PARTICIPANT: can respond to the MC question in the first block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.MC,
              response: {
                choices: [1, 2],
              },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[0])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "SC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "0": "0",
              "1": "0",
              "participants": "0",
            },
          },
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "MC",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "choices": Array [
                    1,
                    2,
                  ],
                },
              },
            ],
            "results": Object {
              "0": "0",
              "1": "1",
              "2": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can jump back to the second question block', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ActivateBlockByIdMutation,
            variables: { sessionId: sessionIdCompleteWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(ensureCacheConsistency(blocks[0], { expectedKeys: [] })).resolves.toMatchInlineSnapshot(`Array []`)
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
            ],
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: is unable to respond to the FREE question a second time', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AddResponseMutation,
          variables: {
            fp: 'myfp2',
            instanceId: instanceIds.FREE,
            response: { value: 'hello different world' },
          },
        },
        authCookieParticipant
      )

      expect(response.body.errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "extensions": Object {
              "code": "FORBIDDEN",
            },
            "locations": Array [
              Object {
                "column": 3,
                "line": 2,
              },
            ],
            "message": "RESPONSE_NOT_ALLOWED",
            "path": Array [
              "addResponse",
            ],
          },
        ]
      `)

      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "dropped": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello different world",
                },
              },
            ],
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
            ],
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })

    it('LECTURER: can reset the results of the second question block (current)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ResetQuestionBlockMutation,
            variables: { sessionId: sessionIdCompleteWithAuth, blockId: blocks[1].id },
          },
          authCookie
        )
      )

      expect(data).toMatchSnapshot()

      expect(
        ensureCacheConsistency(blocks[1], {
          expectedKeys: ['info', 'results'],
          unexpectedKeys: ['participants'],
        })
      ).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "results": Object {
              "participants": "0",
            },
          },
        ]
      `)
    })

    it('PARTICIPANT: can respond to the FREE question in the second block', async () => {
      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.AddResponseMutation,
            variables: {
              fp: 'myfp1',
              instanceId: instanceIds.FREE,
              response: { value: 'hello world' },
            },
          },
          authCookieParticipant
        )
      )

      // ensure that the results in the response cache have been updated
      expect(ensureCacheConsistency(blocks[1])).resolves.toMatchInlineSnapshot(`
        Array [
          Object {
            "info": Object {
              "auth": "true",
              "mode": "COMPLETE",
              "namespace": "UUID_VALID",
              "status": "OPEN",
              "type": "FREE",
            },
            "participantList": Array [
              "UUID_VALID",
              "UUID_VALID",
              "UUID_VALID",
            ],
            "participants": Array [
              "UUID_VALID",
            ],
            "responseHashes": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "hello world",
            },
            "responses": Array [
              Object {
                "participant": "UUID_VALID",
                "response": Object {
                  "value": "hello world",
                },
              },
            ],
            "results": Object {
              "5eb63bbbe01eeed093cb22bb8f5acdc3": "1",
              "participants": "1",
            },
          },
        ]
      `)
    })
  })
  */

  describe('Session Management (authentication, aai)', () => {
    it('enables the creation of a new session)', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateSessionMutation,
            variables: {
              name: 'Session Name (auth & aai)',
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
              participants: [{ username: 'integration-1' }, { username: 'tester-1' }, { username: 'aai-1' }],
              authenticationMode: SESSION_AUTHENTICATION_MODE.AAI,
              storageMode: SESSION_STORAGE_MODE.SECRET,
            },
          },
          authCookie
        )
      )

      console.log(data.createSession.participants)

      expect(data).toMatchSnapshot()
    })
  })

  describe('Admin Area (only possible as an admin)', () => {
    it('login works with valid credentials', async () => {
      await loginAsAdmin(initialPassword)
    })

    it('can update another user as admin', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.ModifyUserAsAdminMutation,
            variables: {
              id: initialDummyId,
              shortname: 'dummy123',
              institution: 'University of Dummy',
              role: ROLES.ADMIN,
            },
          },
          adminAuthCookie
        )
      )
      expect(data).toMatchObject({
        modifyUserAsAdmin: {
          id: initialDummyId,
          shortname: 'dummy123',
          institution: 'University of Dummy',
          role: ROLES.ADMIN,
        },
      })
    })

    it('can get a list of all users as admin', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Queries.UserListQuery,
          },
          adminAuthCookie
        )
      )
      expect(data).toHaveProperty('users')
    })

    it('cannot get a list of all users as regular user', async () => {
      const { body } = await sendQuery(
        {
          query: Queries.UserListQuery,
        },
        authCookie
      )
      expect(body.errors[0].message).toEqual(Errors.UNAUTHORIZED)
    })

    it('cannot update another user as regular user', async () => {
      const { body } = await sendQuery(
        {
          query: Mutations.ModifyUserAsAdminMutation,
          variables: { id: initialDummyId, email: 'aboutToFail@bf.uzh.ch' },
        },
        authCookie
      )
      expect(body.errors[0].message).toEqual(Errors.UNAUTHORIZED)
    })

    it('create and start session for a user', async () => {
      const data = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.CreateSessionMutation,
            variables: {
              name: 'Mock Session',
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
              ],
            },
          },
          authCookie
        )
      )

      sessionId = data.createSession.id

      ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.StartSessionMutation,
            variables: { id: sessionId },
          },
          authCookie
        )
      )
    })

    it('cannot abort a session as a regular user', async () => {
      const { body } = await sendQuery(
        {
          query: Mutations.AbortSessionMutation,
          variables: { id: sessionId },
        },
        authCookie
      )
      expect(body.errors[0].message).toEqual(Errors.UNAUTHORIZED)
    })

    it('can abort a session as an admin', async () => {
      const response = await sendQuery(
        {
          query: Mutations.AbortSessionMutation,
          variables: { id: sessionId },
        },
        adminAuthCookie
      )
      const data = ensureNoErrors(response)
      expect(data.abortSession.status).toEqual('COMPLETED')
    })

    it('can delete the session again', async () => {
      await sendQuery({
        query: Mutations.DeleteSessionsMutation,
        variables: {
          ids: [sessionId],
        },
        authCookie,
      })
    })

    it('cannot delete another user as a regular user', async () => {
      const { body } = await sendQuery(
        {
          query: Mutations.DeleteUserMutation,
          variables: { id: initialDummyId },
        },
        authCookie
      )
      expect(body.errors[0].message).toEqual(Errors.UNAUTHORIZED)
    })

    it('can delete a user as admin', async () => {
      const { deleteUser } = ensureNoErrors(
        await sendQuery(
          {
            query: Mutations.DeleteUserMutation,
            variables: {
              id: initialDummyId,
            },
          },
          adminAuthCookie
        )
      )
      expect(deleteUser).toEqual('ACCOUNT_DELETED')
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

      // expect the response to contain "UNAUTHORIZED"
      // expect(response2.body.errors).toMatchSnapshot()
      expect(response2.body.errors[0].message).toEqual('UNAUTHORIZED')
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
