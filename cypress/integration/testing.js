/* eslint-disable no-undef */

const email = ''
const password = ''

describe('public', () => {
  describe('/', () => {
    it('successfully loads', () => {
      cy.visit('/')
    })
  })

  describe('/user/login', () => {
    it('successfully loads', () => {
      cy.visit('/user/login')
    })

    it.skip('allows logging in', () => {
      cy.get('input[name=email]').type(email)
      cy.get('input[name=password]').type(`${password}{enter}`)

      cy.url().should('include', '/questions')

      // our auth cookie should be present
      cy.getCookie('jwt').should('exist')
    })
  })

  describe('/user/registration', () => {
    it('successfully loads', () => {
      cy.visit('/user/registration')
    })

    it.skip('allows creating a new account', () => {})
  })

  describe('/user/resetPassword', () => {
    it('successfully loads', () => {
      cy.visit('/user/resetPassword')
    })

    it.skip('allows submitting a reset request', () => {})
  })

  describe('/user/requestPassword', () => {
    it('successfully loads', () => {
      cy.visit('/user/requestPassword')
    })
  })
})

describe('protected', () => {
  beforeEach(async () => {
    const LoginMutation = await cy.readFile('src/graphql/mutations/LoginMutation.graphql')
    cy.request('POST', 'http://localhost:4000/graphql', {
      query: LoginMutation,
      variables: {
        email,
        password,
      },
    })
  })

  describe('/questions', () => {
    it('successfully loads', () => {
      cy.visit('/questions')
    })
  })

  describe('/sessions', () => {
    it('successfully loads', () => {
      cy.visit('/sessions')
    })
  })
})
