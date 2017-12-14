/* eslint-disable no-undef */

describe('/', () => {
  it('successfully loads', () => {
    cy.visit('/')
  })
})

describe('/user/login', () => {
  it('successfully loads', () => {
    cy.visit('/user/login')
  })
})

describe('/user/registration', () => {
  it('successfully loads', () => {
    cy.visit('/user/login')
  })
})

describe('/user/resetPassword', () => {
  it('successfully loads', () => {
    cy.visit('/user/login')
  })
})
