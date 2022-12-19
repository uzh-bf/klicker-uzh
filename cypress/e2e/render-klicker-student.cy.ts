describe('Render the homepage for student', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('URL_STUDENT'));
  }),

  it('Render login for student', () => {
    cy.get('#login-logo').should('exist');
  }),

  it('login into student account', () => {
    cy.get('#password-field').type('testing');
    cy.get('#username-field').type('testuser1');
    cy.get('#submit-login').click();
    cy.get('#homepage').should('exist');
  })
})
