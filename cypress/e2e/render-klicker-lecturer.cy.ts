describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    // cy.task('db:seed');
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#login-logo').should('exist');
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
  }),

  /* it('Login into student account', () => {
    cy.get('#homepage').should('exist');
  }),

  it('Create a session with one block', () => {
    const randomTestSessionNumber = Math.round(Math.random() * 1000);
    cy.get('#session-name').type('Test Session ' + randomTestSessionNumber);
    cy.get('#display-name').type('Displayed Name');
    cy.get('#block-container-header').next().type('200, 201, 202');
    cy.get('#create-new-session').click();
    cy.wait(300);
    cy.findByText('Test Session '  + randomTestSessionNumber).should('exist');
  }),

  it('Adding and deleting second question block', () => {
    cy.get('#add-block').click();
    cy.findByText('Block 2').siblings().click();
    cy.findByText('Block 2').should('not.exist');
  }), 

  it('Adding a single choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf dies Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question-title').type(questionTitle);
    cy.findByText('Fragetext hier eingeben…').parent().type(question);
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('50%');
    cy.get('#add-new-answer').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('100%');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('SC');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#sc-answer-options').nextAll().should('have.length', 1);
  })*/

  it('Adding a multiple choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Multiple Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf dies Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findByText('KPRIM (KP)');
    /* cy.get('#question-title').type(questionTitle);
    cy.findByText('Fragetext hier eingeben…').parent().type(question);
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('50%');
    cy.get('#add-new-answer').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('100%');
    cy.get('#add-new-answer').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('25%');
    cy.get('#add-new-answer').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().type('25%');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('SC');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#sc-answer-options').nextAll().should('have.length', 3); */
  })

})
