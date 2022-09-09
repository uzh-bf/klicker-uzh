import { PrismaClient } from '@klicker-uzh/prisma'
import axios from 'axios'
import Redis from 'ioredis'
import JWT from 'jsonwebtoken'
import request from 'supertest'
import prepareApp from '../GraphQL/app'
import { PARTICIPANT_IDS } from '../prisma/constants'

// TODO: switch to ioredis-mock
// jest.mock('ioredis', () => Redis)

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
          loginUser(email: "roland.schlaefli@bf.uzh.ch", password: "abcd")
        }
      `,
      })

    expect(response.headers['set-cookie']).toBeDefined()
    userCookie = response.headers['set-cookie'][0]

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "loginUser": "6f45065c-447f-4259-818c-c6f6b477eb48",
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [],
          },
        },
      }
    `)
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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "createCourse": Object {
            "id": "85f013f3-54a3-48ec-b3a6-ee7717513876",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "85f013f3-54a3-48ec-b3a6-ee7717513876",
                "typename": "Course",
              },
            ],
          },
        },
      }
    `)

    courseId = response.body.data.createCourse.id
  })

  it('allows the user to create a session', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            createSession(name: "Test Session", courseId: "${courseId}", blocks: [{ questionIds: [0, 5, 6] }, { questionIds: [2] }]) {
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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "createSession": Object {
            "activeBlock": null,
            "blocks": Array [
              Object {
                "id": 31,
                "status": "SCHEDULED",
              },
              Object {
                "id": 32,
                "status": "SCHEDULED",
              },
            ],
            "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
            "status": "PREPARED",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
                "typename": "Session",
              },
              Object {
                "id": 31,
                "typename": "SessionBlock",
              },
              Object {
                "id": 32,
                "typename": "SessionBlock",
              },
            ],
          },
        },
      }
    `)

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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "startSession": Object {
            "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
                "typename": "Session",
              },
            ],
          },
        },
      }
    `)
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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "activateSessionBlock": Object {
            "activeBlock": Object {
              "id": 31,
              "instances": Array [
                Object {
                  "id": 65,
                  "questionData": Object {
                    "type": "FREE_TEXT",
                  },
                },
                Object {
                  "id": 66,
                  "questionData": Object {
                    "type": "NUMERICAL",
                  },
                },
                Object {
                  "id": 67,
                  "questionData": Object {
                    "type": "SC",
                  },
                },
              ],
            },
            "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
                "typename": "Session",
              },
              Object {
                "id": 31,
                "typename": "SessionBlock",
              },
              Object {
                "id": 65,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 66,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 67,
                "typename": "QuestionInstance",
              },
            ],
          },
        },
      }
    `)

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

    expect(responses).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "loginParticipant": "6f45065c-667f-4259-818c-c6f6b477eb48",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "0b7c946c-cfc9-4b82-ac97-b058bf48924b",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "16c39a69-03b4-4ce4-a695-e7b93d535598",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "c48f624e-7de9-4e1b-a16d-82d22e64828f",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "7cf9a94a-31a6-4c53-85d7-608dfa904e30",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "f53e6a95-689b-48c0-bfab-6625c04f39ed",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "46407010-0e7c-4903-9a66-2c8d9d6909b0",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "84b0ba5d-34bc-45cd-8253-f3e8c340e5ff",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
        Object {
          "data": Object {
            "loginParticipant": "05a933a0-b2bc-4551-b7e1-6975140d996d",
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [],
            },
          },
        },
      ]
    `)
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

    expect(responses).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 131,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 131,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 132,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 132,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 135,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 135,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 133,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 133,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 134,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 134,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 139,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 139,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 136,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 136,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 138,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 138,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 137,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 137,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
        Object {
          "data": Object {
            "joinCourse": Object {
              "id": 140,
            },
          },
          "extensions": Object {
            "responseCache": Object {
              "invalidatedEntities": Array [
                Object {
                  "id": 140,
                  "typename": "Participation",
                },
              ],
            },
          },
        },
      ]
    `)
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
        'http://127.0.0.1:7072/api/AddResponse',
        {
          instanceId: instances['SC' as any],
          sessionId: session.id,
          response: {
            choices: [1],
          },
        },
        {
          headers: {
            cookie: `participant_token=${jwt}`,
          },
        }
      )
      axios.post(
        'http://127.0.0.1:7072/api/AddResponse',
        {
          instanceId: instances['NUMERICAL' as any],
          sessionId: session.id,
          response: {
            value: 1,
          },
        },
        {
          headers: {
            cookie: `participant_token=${jwt}`,
          },
        }
      )
      axios.post(
        'http://127.0.0.1:7072/api/AddResponse',
        {
          instanceId: instances['FREE_TEXT' as any],
          sessionId: session.id,
          response: {
            value: 'hello test',
          },
        },
        {
          headers: {
            cookie: `participant_token=${jwt}`,
          },
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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "deactivateSessionBlock": Object {
            "activeBlock": null,
            "blocks": Array [
              Object {
                "id": 32,
                "status": "SCHEDULED",
              },
              Object {
                "id": 31,
                "status": "EXECUTED",
              },
            ],
            "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
                "typename": "Session",
              },
              Object {
                "id": 32,
                "typename": "SessionBlock",
              },
              Object {
                "id": 31,
                "typename": "SessionBlock",
              },
            ],
          },
        },
      }
    `)
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

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "activateSessionBlock": Object {
            "activeBlock": Object {
              "id": 32,
              "instances": Array [
                Object {
                  "id": 68,
                  "questionData": Object {
                    "type": "SC",
                  },
                },
              ],
            },
            "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "a5b41ccc-94bc-4e76-9309-1421e74ba0d0",
                "typename": "Session",
              },
              Object {
                "id": 32,
                "typename": "SessionBlock",
              },
              Object {
                "id": 68,
                "typename": "QuestionInstance",
              },
            ],
          },
        },
      }
    `)
  })
})
