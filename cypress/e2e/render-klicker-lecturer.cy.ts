import { contains } from "cypress/types/jquery";

describe('Render the homepage for lecturer', () => {
  before(() => {
    // cy.task('db:seed');
    // you can use cy.exec, instead of cy.task, to execute any system command or script.
  })
  beforeEach(() => {
    // cy.task('db:seed');
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="login-logo"]').should('exist');
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data-cy="submit-login"]').click();
  }),

  /* it('1. Login into lecturer account', () => {
    cy.get('[data-cy="homepage"]').should('exist');
  }),
  
  it('2. Adding and deleting second question block', () => {
    cy.get('[data-cy="add-block"]').click();
    cy.get('[data-cy="delete-block"]').eq(1).click();
    cy.get('[data-cy="block-container-header"]').should('have.length', 1);
  }), 
  
  it('3. Adding a single choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').type(question);
    cy.get('[data-cy="insert-answer-field"]').type('50%');
    cy.get('[data-cy="add-new-answer"]').click();
    cy.get('[data-cy="insert-answer-field"]').eq(1).type('100%');
    cy.get('[data-cy="save-new-question"]').click();
    
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('SC'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="question-preview-button"]').first().click(); // TODO Risky, since we just click on the first preview button, not necessarily related to our question
    cy.get('[data-cy="sc-answer-options"]').nextAll().should('have.length', 1);
  }),
  
  it('4. Create a session with one block', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice ' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;
    const sessionTitle = 'Test Session ' + randomNumber;
    const session = 'Displayed Name ' + randomNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').type(question);
    cy.get('[data-cy="insert-answer-field"]').type('50%');
    cy.get('[data-cy="add-new-answer"]').click();
    cy.get('[data-cy="insert-answer-field"]').eq(1).type('100%');
    cy.get('[data-cy="save-new-question"]').click();

    cy.get('[data-cy="insert-live-session-name"]').type(sessionTitle);
    cy.get('[data-cy="insert-live-display-name"]').type(session);
    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
      dataTransfer
    });
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer
    });
    cy.get('[data-cy="create-new-session"]').click();
    
    cy.get('[data-cy="load-session-list"]').click();
    cy.get('[data-cy="session-block"]').contains(sessionTitle).should('exist');
  }),  */

  it('5. Adding a multiple choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Multiple Choice ' + randomQuestionNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Multiple Choice (MC)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').type(question);
    cy.get('[data-cy="insert-answer-field"]').type('50%');
    cy.get('[data-cy="add-new-answer"]').click();
    cy.get('[data-cy="insert-answer-field"]').eq(1).type('100%');
    cy.get('[data-cy="save-new-question"]').click();

    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('MC'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="question-preview-button"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="sc-answer-options"]').nextAll().should('have.length', 1);
  })/*, 

  it('6. Adding a KPRIM question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A KPRIM ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('KPRIM (KP)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('#insert-question-text').type(question); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('#add-answer-field').type('50%'); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data_cy="add-new-answer"]').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%'); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data_cy="save-new-question"]').click();
    
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('KP'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data_cy="question-preview-button"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data_cy="sc-answer-options"]').nextAll().should('have.length', 1);
  }),

  it('7. Adding a Numeric question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Numeric ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Numerisch (NR)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('#insert-question-text').type(question); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data-cy="set-numerical-minimum"]').type('0');
    cy.get('[data-cy="set-numerical-maximum"]').type('100');
    cy.get('[data_cy="save-new-question"]').click();

    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('NR'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data_cy="question-preview-button"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="input-numerical-minimum"]').contains('Min: 0');
    cy.get('[data-cy="input-numerical-maximum"]').contains('Max: 100');
  }),

  it('8. Adding a Free Text question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Free Text ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data_cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Freitext (FT)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('#insert-question-text').type(question); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data-cy="set-free-text-length"]').type('100');
    cy.get('[data_cy="save-new-question"]').click();

    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText(questionTitle).parent().parent().children().eq(1).contains('FT'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data_cy="question-preview-button"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    // TODO free-text-response-input needs to newly added as data-cy on the correct element
    cy.get('[data-cy="free-text-response-input"]').should('exist');
  }),

  it('9. Workflow of running a session and answering questions', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const session = 'Displayed Name ' + randomNumber;
    const sessionTitle = 'Test Session ' + randomNumber;
    const questionTitle = 'A Single Choice ' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('#insert-question-text').type(question); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('#add-answer-field').type('25%'); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data_cy="add-new-answer"]').click();
    cy.findByText('Antwortmöglichkeit eingeben…').parent().parent().parent().type('100%'); // TODO Didn't work with data-cy yet -> ContentInput
    cy.get('[data_cy="save-new-question"]').click();


    cy.get('[data-cy="question-block"]').contains(questionTitle).siblings().invoke('text').then(text => { // TODO Maybe a way without sibling()
      const onlyId = text.split(' ')[1];
      cy.get('[data-cy="insert-session-name"]').type(sessionTitle);
      cy.get('[data-cy="insert-display-name"]').type(session);
      // TODO insert-question-ids needs to newly added as data-cy on the correct element
      cy.get('[data-cy="insert-question-ids"]').type(onlyId + ', ' +  onlyId);
      cy.get('[data-cy="add-block"]').click();
      // TODO insert-question-ids needs to newly added as data-cy on the correct element
      cy.get('[data-cy="insert-question-ids"]').eq(1).type(onlyId);
      // TODO course-selection-div needs to newly added as data-cy on the correct element
      cy.get('[data-cy="select-question-type"]').click();
      cy.findAllByText('Testkurs').eq(1).click(); // TODO Don't know how this could work with data-cy
      cy.get('[data-cy="create-new-session"]').click();
    });

    cy.get('[data-cy="load-session-list"]').click();
    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.get('[data-cy="interaction-first-block"]').click();
     
    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('[data-cy="username-field"]').type('testuser1');
    cy.get('[data-cy="password-field"]').type('testing');
    cy.get('[data_cy="submit-login"]').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    // TODO student-submit-answer needs to newly added as data-cy on the correct element
    cy.get('[data-cy="student-submit-answer"]').click();
    cy.findByText('25%').click();
    // TODO student-submit-answer needs to newly added as data-cy on the correct element
    cy.get('[data-cy="student-submit-answer"]').click();

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data_cy="submit-login"]').click();
    cy.get('[data-cy="navigation"]').contains("Sessionen").click(); // TODO Can't put data-cy on Navigation.ButtonItem
    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.wait(1000);
    cy.findByText('Block schliessen').click(); // TODO Can't click this button button properly via data-cy
    cy.findByText('Nächsten Block starten').click(); // TODO Can't click this button button properly via data-cy

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('[data-cy="username-field"]').type('testuser1');
    cy.get('[data-cy="password-field"]').type('testing');
    cy.get('[data_cy="submit-login"]').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    // TODO student-submit-answer needs to newly added as data-cy on the correct element
    cy.get('[data-cy="student-submit-answer"]').click();

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data_cy="submit-login"]').click();
    cy.get('[data-cy="navigation"]').contains("Sessionen").click(); // TODO Can't put data-cy on Navigation.ButtonItem
    cy.findByText(sessionTitle).siblings().children().eq(0).click();
    cy.wait(1000);
    cy.findByText('Block schliessen').click(); // TODO Can't click this button button properly via data-cy
    
    cy.url().then(url => {
      const sessionIdEvaluation = url.split('/')[4];
      cy.visit(Cypress.env('URL_LECTURER') + '/sessions/' + sessionIdEvaluation + '/evaluation');
    });

    cy.get('[data-cy="session-total-participants"]').should('have.text', 'Total Teilnehmende: 1');
    cy.get('[data-cy="bar-chart-block-0"]').should('have.text', '1'); // TODO not sure if it works becuase of loading issues of results
    cy.get('[data-cy="evaluate-next-question"]').click();
    cy.get('[data-cy="bar-chart-block-0"]').should('have.text', '1'); // TODO not sure if it works becuase of loading issues of results
    cy.get('[data-cy="evaluate-next-question"]').click();
    cy.get('[data-cy="bar-chart-block-0"]').should('have.text', '1'); // TODO not sure if it works becuase of loading issues of results
  }) */

})
