import { PrismaClient } from '@klicker-uzh/prisma'
import axios from 'axios'
import Redis from 'ioredis'
import JWT from 'jsonwebtoken'
import request from 'supertest'
import prepareApp from '../GraphQL/app'

const PARTICIPANT_IDS = [
  '6f45065c-667f-4259-818c-c6f6b477eb48',
  '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
  '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
  '16c39a69-03b4-4ce4-a695-e7b93d535598',
  'c48f624e-7de9-4e1b-a16d-82d22e64828f',
  '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
  'f53e6a95-689b-48c0-bfab-6625c04f39ed',
  '46407010-0e7c-4903-9a66-2c8d9d6909b0',
  '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
  '05a933a0-b2bc-4551-b7e1-6975140d996d',
]

// TODO: switch to ioredis-mock
// jest.mock('ioredis', () => Redis)

jest.setTimeout(60000)

process.env.NODE_ENV = 'development'
process.env.APP_SECRET = 'abcd'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('API', () => {
  let prisma: PrismaClient
  let redisCache: Redis
  let redisExec: Redis
  let app: Express.Application
  let userCookie: string = ''
  let participantCookies: string[] = []
  let session: any
  let courseId: any
  let instances: any[]
  let feedback1: any
  let feedback2: any

  beforeAll(() => {
    prisma = new PrismaClient()
    redisCache = new Redis({
      family: 4,
      host: process.env.REDIS_CACHE_HOST ?? '127.0.0.1',
      password: process.env.REDIS_CACHE_PASS ?? '',
      port: Number(process.env.REDIS_CACHE_PORT) ?? 6379,
      tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
    })
    redisExec = new Redis({
      family: 4,
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      password: process.env.REDIS_PASS ?? '',
      port: Number(process.env.REDIS_PORT) ?? 6380,
      tls: process.env.REDIS_TLS ? {} : undefined,
    })
  })

  afterAll(async () => {
    await redisCache.quit()
    await redisExec.quit()
  })

  beforeEach(() => {
    app = prepareApp({ prisma, redisCache, redisExec })
  })

  it('allows logging in a user', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .send({
        query: `
        mutation {
          loginUser(email: "roland.schlaefli@bf.uzh.ch", password: "testing")
        }
      `,
      })

    expect(response.headers['set-cookie']).toBeDefined()
    userCookie = response.headers['set-cookie'][0]

    expect(response.body).toMatchInlineSnapshot(
      {
        data: { loginUser: expect.any(String) },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "loginUser": Any<String>,
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the user to create a course', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            createCourse(name: "Test Course", color: "#016272") {
                id
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: { createCourse: { id: expect.any(String) } },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createCourse": Object {
            "id": Any<String>,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    courseId = response.body.data.createCourse.id
  })

  it('allows the user to create a session', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            createSession(name: "Test Session", courseId: "${courseId}", blocks: [{ questionIds: [5, 6, 7] }, { questionIds: [8, 9] }]) {
                id
                status
                activeBlock {
                  id
                }
                blocks {
                    id
                    status
                }
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          createSession: {
            id: expect.any(String),
            blocks: new Array(2).fill({
              id: expect.any(Number),
            }),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createSession": Object {
            "activeBlock": null,
            "blocks": Array [
              Object {
                "id": Any<Number>,
                "status": "SCHEDULED",
              },
              Object {
                "id": Any<Number>,
                "status": "SCHEDULED",
              },
            ],
            "id": Any<String>,
            "status": "PREPARED",
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    session = response.body.data.createSession
  })

  it('allows the user to start a session', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            startSession(id: "${session.id}") {
                id
                status
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          startSession: {
            id: expect.any(String),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "startSession": Object {
            "id": Any<String>,
            "status": "RUNNING",
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the user to change important session parameters', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            changeSessionSettings(id: "${session.id}", isAudienceInteractionActive: true, isModerationEnabled: false, isGamificationEnabled: true) {
                id
                isAudienceInteractionActive
                isModerationEnabled
                isGamificationEnabled
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          changeSessionSettings: {
            id: expect.any(String),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "changeSessionSettings": Object {
            "id": Any<String>,
            "isAudienceInteractionActive": true,
            "isGamificationEnabled": true,
            "isModerationEnabled": false,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the user to activate a session block', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            activateSessionBlock(sessionId: "${session.id}", sessionBlockId: ${session.blocks[0].id}) {
                id
                status
                activeBlock {
                  id
                  instances {
                    id
                    questionData {
                      type
                    }
                  }
                }
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          activateSessionBlock: {
            id: expect.any(String),
            activeBlock: {
              id: expect.any(Number),
              instances: new Array(3).fill({
                id: expect.any(Number),
              }),
            },
          },
        },

        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "activateSessionBlock": Object {
            "activeBlock": Object {
              "id": Any<Number>,
              "instances": Array [
                Object {
                  "id": Any<Number>,
                  "questionData": Object {
                    "type": "NUMERICAL",
                  },
                },
                Object {
                  "id": Any<Number>,
                  "questionData": Object {
                    "type": "FREE_TEXT",
                  },
                },
                Object {
                  "id": Any<Number>,
                  "questionData": Object {
                    "type": "NUMERICAL",
                  },
                },
              ],
            },
            "id": Any<String>,
            "status": "RUNNING",
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    instances =
      response.body.data.activateSessionBlock.activeBlock.instances.reduce(
        (acc: any, instance: any) => {
          return {
            ...acc,
            [instance.questionData.type]: instance.id,
          }
        },
        {}
      )
  })

  it('allows logging in participants', async () => {
    const responses = await Promise.all(
      PARTICIPANT_IDS.map(async (_, ix) => {
        const response = await request(app)
          .post('/api/graphql')
          .send({
            query: `
        mutation {
          loginParticipant(username: "testuser${ix + 1}", password: "testing")
        }
      `,
          })

        expect(response.headers['set-cookie']).toBeDefined()
        participantCookies = [
          ...participantCookies,
          response.headers['set-cookie'][0],
        ]

        return response.body
      })
    )

    expect(responses).toMatchInlineSnapshot(
      new Array(10).fill({
        data: { loginParticipant: expect.any(String) },
        extensions: expect.any(Object),
      }),
      `
      Array [
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "loginParticipant": Any<String>,
          },
          "extensions": Any<Object>,
        },
      ]
    `
    )
  })

  it('allows participants to join a course', async () => {
    const responses = await Promise.all(
      PARTICIPANT_IDS.map(async (_, ix) => {
        const response = await request(app)
          .post('/api/graphql')
          .set('Cookie', [participantCookies[ix]])
          .send({
            query: `
        mutation {
          joinCourse(courseId: "${courseId}") {
            id
          }
        }
      `,
          })
        return response.body
      })
    )

    expect(responses).toMatchInlineSnapshot(
      new Array(10).fill({
        data: { joinCourse: { id: expect.any(Number) } },
        extensions: expect.any(Object),
      }),
      `
      Array [
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": Any<Number>,
            },
          },
          "extensions": Any<Object>,
        },
      ]
    `
    )
  })

  it('allows participants to add some responses', async () => {
    for (let i = 0; i < 10; i++) {
      await sleep(100 * i)

      const jwt = JWT.sign(
        { sub: PARTICIPANT_IDS[i], role: 'PARTICIPANT' },
        process.env.APP_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: '1w',
        }
      )

      axios.post(
        process.env.ADD_RESPONSE_URL as string,
        {
          instanceId: instances['SC' as any],
          sessionId: session.id,
          response: { choices: [1] },
        },
        {
          headers: { cookie: `participant_token=${jwt}` },
        }
      )
      axios.post(
        process.env.ADD_RESPONSE_URL as string,
        {
          instanceId: instances['KPRIM' as any],
          sessionId: session.id,
          response: { choices: [2] },
        },
        {
          headers: { cookie: `participant_token=${jwt}` },
        }
      )
      axios.post(
        process.env.ADD_RESPONSE_URL as string,
        {
          instanceId: instances['NUMERICAL' as any],
          sessionId: session.id,
          response: { value: 1 },
        },
        {
          headers: { cookie: `participant_token=${jwt}` },
        }
      )
      axios.post(
        process.env.ADD_RESPONSE_URL as string,
        {
          instanceId: instances['FREE_TEXT' as any],
          sessionId: session.id,
          response: { value: 'hello test' },
        },
        {
          headers: { cookie: `participant_token=${jwt}` },
        }
      )
    }
  })

  it('allows the user to deactivate a session block', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            deactivateSessionBlock(sessionId: "${session.id}", sessionBlockId: ${session.blocks[0].id}) {
                id
                status
                activeBlock {
                  id
                }
                blocks {
                    id
                    status
                }
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          deactivateSessionBlock: {
            id: expect.any(String),
            blocks: new Array(2).fill({
              id: expect.any(Number),
            }),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "deactivateSessionBlock": Object {
            "activeBlock": null,
            "blocks": Array [
              Object {
                "id": Any<Number>,
                "status": "SCHEDULED",
              },
              Object {
                "id": Any<Number>,
                "status": "EXECUTED",
              },
            ],
            "id": Any<String>,
            "status": "RUNNING",
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the user to activate a session block', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            activateSessionBlock(sessionId: "${session.id}", sessionBlockId: ${session.blocks[1].id}) {
                id
                status
                activeBlock {
                  id
                  instances {
                    id
                    questionData {
                      type
                    }
                  }
                }
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          activateSessionBlock: {
            id: expect.any(String),
            activeBlock: {
              id: expect.any(Number),
              instances: new Array(2).fill({
                id: expect.any(Number),
              }),
            },
          },
        },

        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "activateSessionBlock": Object {
            "activeBlock": Object {
              "id": Any<Number>,
              "instances": Array [
                Object {
                  "id": Any<Number>,
                  "questionData": Object {
                    "type": "SC",
                  },
                },
                Object {
                  "id": Any<Number>,
                  "questionData": Object {
                    "type": "KPRIM",
                  },
                },
              ],
            },
            "id": Any<String>,
            "status": "RUNNING",
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the participants to add feedbacks with or without login', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .send({
        query: `
        mutation {
            createFeedback(sessionId: "${session.id}", content: "Published Feedback Nr. 1 without participant", isPublished: true) {
                id
                content
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          createFeedback: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createFeedback": Object {
            "content": "Published Feedback Nr. 1 without participant",
            "id": Any<Number>,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    const response2 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [participantCookies[0]])
      .send({
        query: `
        mutation {
            createFeedback(sessionId: "${session.id}", content: "Published Feedback Nr. 2 of logged in participant", isPublished: true) {
                id
                content
            }
        }
      `,
      })

    expect(response2.body).toMatchInlineSnapshot(
      {
        data: {
          createFeedback: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createFeedback": Object {
            "content": "Published Feedback Nr. 2 of logged in participant",
            "id": Any<Number>,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    const response3 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [participantCookies[0]])
      .send({
        query: `
        mutation {
            createFeedback(sessionId: "${session.id}", content: "Feedback resolved without responses", isPublished: true) {
                id
                content
            }
        }
      `,
      })

    expect(response3.body).toMatchInlineSnapshot(
      {
        data: {
          createFeedback: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createFeedback": Object {
            "content": "Feedback resolved without responses",
            "id": Any<Number>,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    const response4 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [participantCookies[0]])
      .send({
        query: `
        mutation {
            createFeedback(sessionId: "${session.id}", content: "Feedback resolved with responses", isPublished: true) {
                id
                content
            }
        }
      `,
      })

    expect(response4.body).toMatchInlineSnapshot(
      {
        data: {
          createFeedback: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "createFeedback": Object {
            "content": "Feedback resolved with responses",
            "id": Any<Number>,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    feedback1 = response3.body.data.createFeedback
    feedback2 = response4.body.data.createFeedback
  })

  it('allows the user to resolve a feedback', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            resolveFeedback(id: ${feedback1.id}, newValue: true) {
                id
                isResolved
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          resolveFeedback: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "resolveFeedback": Object {
            "id": Any<Number>,
            "isResolved": true,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the user to respond to a feedback', async () => {
    const response1 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            respondToFeedback(id: ${feedback2.id}, responseContent: "Response 1") {
                id
                isResolved
                responses {
                  id
                  content
                  positiveReactions
                  negativeReactions
                }
            }
        }
      `,
      })

    const response2 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            respondToFeedback(id: ${feedback2.id}, responseContent: "Response 2") {
                id
                isResolved
                responses {
                  id
                  content
                  positiveReactions
                  negativeReactions
                }
            }
        }
      `,
      })

    expect(response2.body).toMatchInlineSnapshot(
      {
        data: {
          respondToFeedback: {
            id: expect.any(Number),
            responses: new Array(2).fill({
              id: expect.any(Number),
            }),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "respondToFeedback": Object {
            "id": Any<Number>,
            "isResolved": true,
            "responses": Array [
              Object {
                "content": "Response 1",
                "id": Any<Number>,
                "negativeReactions": 0,
                "positiveReactions": 0,
              },
              Object {
                "content": "Response 2",
                "id": Any<Number>,
                "negativeReactions": 0,
                "positiveReactions": 0,
              },
            ],
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })

  it('allows the participants to add confusion feedbacks with or without login', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .send({
        query: `
        mutation {
          addConfusionTimestep(sessionId: "${session.id}", difficulty: 0, speed: 1) {
                id
                difficulty
                speed
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(
      {
        data: {
          addConfusionTimestep: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "addConfusionTimestep": Object {
            "difficulty": 0,
            "id": Any<Number>,
            "speed": 1,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )

    const response2 = await request(app)
      .post('/api/graphql')
      .set('Cookie', [participantCookies[0]])
      .send({
        query: `
        mutation {
          addConfusionTimestep(sessionId: "${session.id}", difficulty: -2, speed: 0) {
                id
                difficulty
                speed
            }
        }
      `,
      })

    expect(response2.body).toMatchInlineSnapshot(
      {
        data: {
          addConfusionTimestep: {
            id: expect.any(Number),
          },
        },
        extensions: expect.any(Object),
      },
      `
      Object {
        "data": Object {
          "addConfusionTimestep": Object {
            "difficulty": -2,
            "id": Any<Number>,
            "speed": 0,
          },
        },
        "extensions": Any<Object>,
      }
    `
    )
  })
})
