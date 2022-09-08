import { PrismaClient } from '@klicker-uzh/prisma'
import axios from 'axios'
import Redis from 'ioredis'
import JWT from 'jsonwebtoken'
import request from 'supertest'
import prepareApp from '../GraphQL/app'

// TODO: switch to ioredis-mock
// jest.mock('ioredis', () => Redis)

process.env.NODE_ENV = 'development'
process.env.APP_SECRET = 'abcd'

describe('API', () => {
  let prisma: PrismaClient
  let redisCache: Redis
  let redisExec: Redis
  let app: Express.Application
  let userCookie: string = ''
  let session: any
  let instances: any[]

  beforeAll(() => {
    prisma = new PrismaClient()
    redisCache = new Redis({
      family: 4,
      host: process.env.REDIS_CACHE_HOST ?? 'localhost',
      password: process.env.REDIS_CACHE_PASS ?? '',
      port: Number(process.env.REDIS_CACHE_PORT) ?? 6379,
      tls: process.env.REDIS_CACHE_TLS ? {} : undefined,
    })
    redisExec = new Redis({
      family: 4,
      host: process.env.REDIS_HOST ?? 'localhost',
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

  it('allows the user to create a session', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            createSession(name: "Test Session", blocks: [{ questionIds: [0, 5, 6] }, { questionIds: [2] }]) {
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
                "id": 30,
                "status": "SCHEDULED",
              },
              Object {
                "id": 31,
                "status": "SCHEDULED",
              },
            ],
            "id": "3e743ea5-b770-4590-9137-5881c0df4396",
            "status": "PREPARED",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "3e743ea5-b770-4590-9137-5881c0df4396",
                "typename": "Session",
              },
              Object {
                "id": 30,
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
          "startSession": Object {
            "activeBlock": null,
            "blocks": null,
            "id": "3e743ea5-b770-4590-9137-5881c0df4396",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "3e743ea5-b770-4590-9137-5881c0df4396",
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
              "id": 30,
              "instances": Array [
                Object {
                  "id": 63,
                  "questionData": Object {
                    "type": "FREE_TEXT",
                  },
                },
                Object {
                  "id": 64,
                  "questionData": Object {
                    "type": "NUMERICAL",
                  },
                },
                Object {
                  "id": 65,
                  "questionData": Object {
                    "type": "SC",
                  },
                },
              ],
            },
            "id": "3e743ea5-b770-4590-9137-5881c0df4396",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "3e743ea5-b770-4590-9137-5881c0df4396",
                "typename": "Session",
              },
              Object {
                "id": 30,
                "typename": "SessionBlock",
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": 63,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 64,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 65,
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

  it('allows participants to add some responses', async () => {
    for (let i = 0; i < 10; i++) {
      const jwt = JWT.sign(
        { sub: `testparticipant-${i}`, role: 'PARTICIPANT' },
        process.env.APP_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: '1w',
        }
      )

      axios.post(
        'http://localhost:7072/api/AddResponse',
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
        'http://localhost:7072/api/AddResponse',
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
        'http://localhost:7072/api/AddResponse',
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

  it.skip('allows the user to deactivate a session block', async () => {
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
            "activeBlock": Object {
              "id": 18,
            },
            "blocks": null,
            "id": "b7e908e6-4e86-45a8-9e89-f9e65402bf44",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "b7e908e6-4e86-45a8-9e89-f9e65402bf44",
                "typename": "Session",
              },
              Object {
                "id": 18,
                "typename": "SessionBlock",
              },
            ],
          },
        },
      }
    `)
  })
})
