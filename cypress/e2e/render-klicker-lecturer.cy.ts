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

  it('Create a session with one block', () => {
    const randomTestSessionNumber = Math.round(Math.random() * 1000);
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#session-name').type('Test Session ' + randomTestSessionNumber);
    cy.get('#display-name').type('Displayed Name');
    cy.get('#block-container-header').next().type('200, 201, 202');
    cy.get('#create-new-session').click();
    cy.wait(300);
    cy.findByText('Test Session '  + randomTestSessionNumber).should('exist');
  })

  it('Adding and deleting second question block', () => {
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#add-block').click();
    cy.findByText('Block 2').siblings().click();
    cy.findByText('Block 2').should('not.exist');
  })
})