describe('Login workflows for lecturer and students', () => {
  it('signs in into student account', () => {
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('[data-cy="login-logo"]').should('exist');
    cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'));
    cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'));
    cy.get('[data-cy="submit-login"]').click();
    cy.get('[data-cy="homepage"]').should('exist');
  }),
  
  it('signs in into lecturer account', () => {
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.wait(20000);
    cy.get('[data-cy="login-logo"]').should('exist');
    cy.get('[data-cy="email-field"]').type(Cypress.env('LECTURER_EMAIL'));
    cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'));
    cy.get('[data-cy="submit-login"]').click();
    cy.get('[data-cy="homepage"]').should('exist');
  })
})
