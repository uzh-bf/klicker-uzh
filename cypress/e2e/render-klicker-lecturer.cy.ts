describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('URL_LECTURER'));
  }),

  it('Render login for lecturer', () => {
    cy.get('#login-logo').should('exist');
  }),

  it('Login into student account', () => {
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#homepage').should('exist');
  })

  it('Adding a second question block', () => {
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#add-block').click();
    //cy.get('#live-session-form').should('exist');
    //cy.get('#display-name').should('exist');
  })
})