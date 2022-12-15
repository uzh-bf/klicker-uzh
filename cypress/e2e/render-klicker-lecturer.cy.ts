describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    // cy.task('db:seed');
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#login-logo').should('exist');
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
  }),

  /* it('1. Login into student account', () => {
    cy.get('#homepage').should('exist');
  }),

  it('2. Create a session with one block', () => {
    const randomTestSessionNumber = Math.round(Math.random() * 1000);
    cy.get('#session-name').type('Test Session ' + randomTestSessionNumber);
    cy.get('#display-name').type('Displayed Name');
    cy.get('#block-container-header').next().type('200, 201, 202');
    cy.get('#create-new-session').click();
    cy.findByText('Test Session '  + randomTestSessionNumber, {timeout: 5000}).should('exist');
  }),

  it('3. Adding and deleting second question block', () => {
    cy.get('#add-block').click();
    cy.findByText('Block 2').siblings().click();
    cy.findByText('Block 2').should('not.exist');
  }),

  it('4. Adding a single choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf diese Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO: Find a better solution. This is really ugly. 
    // But get('#add-answer-field') only yields the first one and not the seconde on as well
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('SC');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#sc-answer-options').nextAll().should('have.length', 1);
  }),

  it('5. Adding a multiple choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Multiple Choice ' + randomQuestionNumber;
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf dies Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('Multiple Choice (MC)').eq(1).click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO: Find a better solution. This is really ugly. 
    // But get('#add-answer-field') only yields the first one and not the seconde on as well
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('MC');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#sc-answer-options').nextAll().should('have.length', 1);
  }),

  it('6. Adding a KPRIM question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A KPRIM ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf diese Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('KPRIM (KP)').eq(1).click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO: Find a better solution. This is really ugly. 
    // But get('#add-answer-field') only yields the first one and not the seconde on as well
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('KP');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#sc-answer-options').nextAll().should('have.length', 1);
  }),

  it('7. Adding a Numeric question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Numeric ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf diese Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('Numerisch (NR)').click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#set-numerical-minimum').type('0');
    cy.get('#set-numerical-maximum').type('100');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('NR');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#input-numerical-minimum').contains('Min: 0');
    cy.get('#input-numerical-maximum').contains('Max: 100');
  }),

  it('8. Adding a Free Text question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Free Text ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit, dass die Antwort auf diese Frage richtig ist?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('Freitext (FT)').click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#set-free-text-length').type('100');
    cy.get('#save-new-question').click();
    cy.wait(300);
    cy.findByText(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('FT');
    cy.findByText(questionTitle).parent().parent().children().eq(2).contains(question);
    cy.get('#question-preview').first().click();
    cy.get('#responseInput').should('exist');
  }), */

  it('9. Workflow of running a session and answering questions', () => {
    const randomTestSessionNumber = Math.round(Math.random() * 1000);
    const sessionTitle = 'Test Session ' + randomTestSessionNumber;

    cy.get('#session-name').type(sessionTitle);
    cy.get('#display-name').type('Displayed Name');
    cy.get('#block-container-header').next().type('202');
    cy.get('#create-new-session').click();

    cy.findByText(sessionTitle).siblings().get('#start-session-button').click();
    cy.get('#interaction-first-block').click();
    
    cy.url().then(url => {
      const sessionId = url.split('/')[4];
      cy.visit(Cypress.env('URL_STUDENT') + '/session/' + sessionId);
    });

    // TODO This is dependent on the question 202 being a single or multiple choice question. Maybe something more independent is also possible.
    cy.findByText('... über 1.0.').click();
    cy.findByText('Absenden').click();

    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#header-sessions-button').click();
    
    cy.findByText(sessionTitle).siblings().findByText('Dozierenden Cockpit').click();
    cy.get('#interaction-first-block').click();
    cy.url().then(url => {
      const sessionIdEvaluation = url.split('/')[4];
      cy.visit(Cypress.env('URL_LECTURER') + '/sessions/' + sessionIdEvaluation + '/evaluation');
    });

    /* cy.get('#bar-chart-block-3').children().should('eq', 1);
    cy.get('#session-total-participants').should('eq', 'Total Teilnehmende: 1'); */
  })

})
