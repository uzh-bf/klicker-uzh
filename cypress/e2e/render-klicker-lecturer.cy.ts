describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('URL_LECTURER'));
  }),

  it('Render login for lecturer', () => {
    cy.get('#login-logo').should('exist');
  }),

  it('login into student account', () => {
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#homepage').should('exist');
  })
})