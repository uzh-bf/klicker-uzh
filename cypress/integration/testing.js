/* eslint-disable no-undef */

// TODO: somehow import this from .graphql
const LoginMutation = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      id
      email
      shortname
      runningSession {
        id
      }
    }
  }
`

const email = ''
const password = ''

describe('/', () => {
  it('successfully loads', () => {
    cy.visit('/')
  })
})

describe('/user/login', () => {
  it('successfully loads', () => {
    cy.visit('/user/login')
  })

  it('allows logging in', () => {
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

describe('/questions', () => {
  beforeEach(() => {
    cy.request('POST', 'http://localhost:4000/graphql', {
      query: LoginMutation,
      variables: {
        email,
        password,
      },
    })
  })

  it('successfully loads', () => {
    cy.visit('/questions')
  })
})

describe('/sessions', () => {
  it('successfully loads', () => {
    cy.visit('/sessions')
  })
})
