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
  let participantCookie: string = ''
  let session: any
  let course: any
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
            createCourse(name: "Test Course") {
                id
            }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "createCourse": Object {
            "id": "d594834d-f60f-4624-87af-616d7525f16c",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "d594834d-f60f-4624-87af-616d7525f16c",
                "typename": "Course",
              },
            ],
          },
        },
      }
    `)

    course = response.body.data.createCourse
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
                "id": 7,
                "status": "SCHEDULED",
              },
              Object {
                "id": 8,
                "status": "SCHEDULED",
              },
            ],
            "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
            "status": "PREPARED",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
                "typename": "Session",
              },
              Object {
                "id": 7,
                "typename": "SessionBlock",
              },
              Object {
                "id": 8,
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
            "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
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
              "id": 7,
              "instances": Array [
                Object {
                  "id": 17,
                  "questionData": Object {
                    "type": "FREE_TEXT",
                  },
                },
                Object {
                  "id": 18,
                  "questionData": Object {
                    "type": "NUMERICAL",
                  },
                },
                Object {
                  "id": 19,
                  "questionData": Object {
                    "type": "SC",
                  },
                },
              ],
            },
            "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
            "status": "RUNNING",
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": "20f66723-6300-4d39-9ae1-d46b1cee638e",
                "typename": "Session",
              },
              Object {
                "id": 7,
                "typename": "SessionBlock",
              },
              Object {
                "id": 17,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 18,
                "typename": "QuestionInstance",
              },
              Object {
                "id": 19,
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

  it('allows logging in a participant', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .send({
        query: `
        mutation {
          loginParticipant(username: "rschlaefli", password: "testing")
        }
      `,
      })

    expect(response.headers['set-cookie']).toBeDefined()
    participantCookie = response.headers['set-cookie'][0]

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "loginParticipant": "6f45065c-667f-4259-818c-c6f6b477eb48",
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [],
          },
        },
      }
    `)
  })

  it('allows participants to join a course', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [participantCookie])
      .send({
        query: `
        mutation {
          joinCourse(courseId: "${course.id}") {
            id
          }
        }
      `,
      })

    expect(response.body).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "joinCourse": Object {
            "id": 3,
          },
        },
        "extensions": Object {
          "responseCache": Object {
            "invalidatedEntities": Array [
              Object {
                "id": 3,
                "typename": "Participation",
              },
            ],
          },
        },
      }
    `)
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
