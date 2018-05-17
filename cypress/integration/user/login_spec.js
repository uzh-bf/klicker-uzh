/* eslint-disable no-undef */

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
