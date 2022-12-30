describe('Render the homepage for student', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('URL_STUDENT'));
  }),

  it('Render login for student', () => {
    cy.get('[data-cy="login-logo"]').should('exist');
  }),

  it('login into student account', () => {
    cy.get('[data-cy="username-field"]').type('testuser1');
    cy.get('[data-cy="password-field"]').type('testing');
    cy.get('[data-cy="submit-login"]').click();
    cy.get('[data-cy="homepage"]').should('exist');
  })
})
