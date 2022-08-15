import request from 'supertest'

import app from '../src/app'

describe('GraphQL API', () => {
  it('works', async () => {
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ hello }' })

    expect(response.body).toMatchInlineSnapshot()
  })
})
