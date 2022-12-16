describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    // cy.task('db:seed');
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#login-logo').should('exist');
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
  }),

  it('1. Login into lecturer account', () => {
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
    const question = 'Was ist die Wahrscheinlichkeit?';

    cy.get('#create-question').click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO Find a better solution. This is really ugly. get('#add-answer-field') only yields the first one and not the seconde on as well
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
    const question = 'Was ist die Wahrscheinlichkeit?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('Multiple Choice (MC)').eq(1).click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO Find a better solution. This is really ugly. get('#add-answer-field') only yields the first one and not the seconde on as well
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
    const question = 'Was ist die Wahrscheinlichkeit?';

    cy.get('#create-question').click();
    cy.get('#question_create_select').click();
    cy.findAllByText('KPRIM (KP)').eq(1).click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('50%');
    cy.get('#add-new-answer').click();
    // TODO Find a better solution. This is really ugly. get('#add-answer-field') only yields the first one and not the seconde on as well
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
    const question = 'Was ist die Wahrscheinlichkeit?';

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
    const question = 'Was ist die Wahrscheinlichkeit?';

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
  }),

  it('9. Workflow of running a session and answering questions', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const session = 'Displayed Name ' + randomNumber;
    const sessionTitle = 'Test Session ' + randomNumber;
    const questionTitle = 'A Single Choice ' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit?';

    cy.get('#create-question').click();
    cy.get('#question-title').type(questionTitle);
    cy.get('#question-text').type(question);
    cy.get('#add-answer-field').type('25%');
    cy.get('#add-new-answer').click();
    // TODO Find a better solution. This is really ugly. get('#add-answer-field') only yields the first one and not the seconde on as well
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%');
    cy.get('#save-new-question').click();
    cy.findByText(questionTitle).siblings().invoke('text').then(text => {
      console.log(text)
      const onlyId = text.split(' ')[1];
      cy.get('#session-name').type(sessionTitle);
      cy.get('#display-name').type(session);
      cy.get('#block-container-header').next().type(onlyId + ', ' +  onlyId);
      cy.get('#add-block').click();
      cy.findByText('Block 2').parent().siblings().eq(0).type(onlyId);
      cy.get('#course_selection').click();
      cy.findAllByText('Testkurs').eq(0).click();
      cy.get('#create-new-session').click();
    });

    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.get('#interaction-first-block').click();
     
    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('#username-field').type('testuser1');
    cy.get('#password-field').type('testing');
    cy.get('#submit-login').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    cy.findByText('Absenden').click();
    cy.findByText('25%').click();
    cy.findByText('Absenden').click();

    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#header-sessions-button').click();
    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.wait(1000);
    cy.findByText('Block schliessen').click();
    cy.findByText('Nächsten Block starten').click();

    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('#password-field').type('testing');
    cy.get('#username-field').type('testuser1');
    cy.get('#submit-login').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    cy.findByText('Absenden').click();

    cy.clearAllCookies()
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('#email-field').type('lecturer@bf.uzh.ch');
    cy.get('#password-field').type('abcd');
    cy.get('#submit-login').click();
    cy.get('#header-sessions-button').click();
    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.wait(1000);
    cy.findByText('Block schliessen').click();
    
    cy.url().then(url => {
      const sessionIdEvaluation = url.split('/')[4];
      cy.visit(Cypress.env('URL_LECTURER') + '/sessions/' + sessionIdEvaluation + '/evaluation');
    });

    cy.get('#session-total-participants').should('have.text', 'Total Teilnehmende: 1');
    cy.get('#bar-chart-block-0').should('have.text', '1');
    cy.get('#evaluate-next-question').click();
    cy.get('#bar-chart-block-0').should('have.text', '1');
    cy.get('#evaluate-next-question').click();
    cy.get('#bar-chart-block-0').should('have.text', '1');
  })

})
