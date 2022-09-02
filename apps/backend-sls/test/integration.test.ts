import Redis from 'ioredis'
import request from 'supertest'
import prepareApp from '../GraphQL/app'

// TODO: switch to ioredis-mock
// jest.mock('ioredis', () => Redis)

describe('API', () => {
  let redisCache: Redis
  let redisExec: Redis
  let app: Express.Application
  let userCookie: string = ''

  beforeAll(() => {
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
    app = prepareApp({ redisCache, redisExec })
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
            createSession(name: "Test Session", blocks: [{ questionIds: ["996f208b-d567-4f1e-8c57-6f555866c33a", "996f208b-d567-4f1e-8c57-6f555866c33b"] }, { questionIds: ["996f208b-d567-4f1e-8c57-6f555866c33c"] }]) {
                id
                status
                activeBlock
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
          "createSession": null,
        },
        "errors": Array [
          Object {
            "locations": Array [
              Object {
                "column": 13,
                "line": 3,
              },
            ],
            "message": "Unexpected error.",
            "path": Array [
              "createSession",
            ],
          },
        ],
      }
    `)
  })

  it('allows the user to start a session', async () => {
    const response = await request(app)
      .post('/api/graphql')
      .set('Cookie', [userCookie])
      .send({
        query: `
        mutation {
            startSession(id: "e0154d2a-314e-4a28-af9e-9ebf826a9b65") {
                id
                status
                activeBlock
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
            "activeBlock": 0,
            "blocks": Array [
              Object {
                "id": "1",
                "status": "ACTIVE",
              },
            ],
            "id": "e0154d2a-314e-4a28-af9e-9ebf826a9b65",
            "status": "RUNNING",
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
            activateSessionBlock(sessionId: "e0154d2a-314e-4a28-af9e-9ebf826a9b65", sessionBlockId: 1) {
                id
                status
                activeBlock
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
          "activateSessionBlock": Object {
            "activeBlock": 0,
            "blocks": Array [
              Object {
                "id": "1",
                "status": "ACTIVE",
              },
            ],
            "id": "e0154d2a-314e-4a28-af9e-9ebf826a9b65",
            "status": "RUNNING",
          },
        },
      }
    `)
  })
})
