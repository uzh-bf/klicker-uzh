import { should } from "chai";

describe('Render the homepage for lecturer', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="login-logo"]').should('exist');
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data-cy="submit-login"]').click();
  }),

  it('1. Login into lecturer account', () => {
    cy.get('[data-cy="homepage"]').should('exist');
  }),
   
  it('2. Adding and deleting second question block', () => {
    cy.get('[data-cy="insert-live-session-name"]').type("test session");
    cy.get('[data-cy="insert-live-display-name"]').type("test session");
    cy.get('[data-cy="next-or-submit"]').click();
    cy.get('[data-cy="next-or-submit"]').click();
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
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
     
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText('SC - ' + questionTitle).parent().parent().parent().parent().parent().parent().children().eq(0).contains('SC'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky, since we just click on the first preview button, not necessarily related to our question
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
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
 
    cy.get('[data-cy="insert-live-session-name"]').type(sessionTitle);
    cy.get('[data-cy="insert-live-display-name"]').type(session);
    cy.get('[data-cy="next-or-submit"]').click();
    cy.get('[data-cy="next-or-submit"]').click();
 
    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
      dataTransfer
    });
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer
    });
    cy.get('[data-cy="next-or-submit"]').click();
 
    cy.get('[data-cy="load-session-list"]').click();
    cy.get('[data-cy="session-block"]').contains(sessionTitle).should('exist');
  }),
 
  it('5. Adding a multiple choice question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Multiple Choice ' + randomQuestionNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Multiple Choice (MC)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
// 
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText("MC - " + questionTitle).parent().parent().parent().parent().parent().parent().children().eq(0).contains('MC'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="sc-answer-options"]').nextAll().should('have.length', 1);
  }),

  it('6. Adding a KPRIM question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A KPRIM ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('KPRIM (KP)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
    
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText("KPRIM - " + questionTitle).parent().parent().parent().parent().parent().parent().children().eq(0).contains('KP'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="sc-answer-options"]').nextAll().should('have.length', 1);
  }),
 
  it('7. Adding a Numeric question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Numeric ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;
 
    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Numerisch (NR)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="set-numerical-minimum"]').click().type('0');
    cy.get('[data-cy="set-numerical-maximum"]').click().type('100');
    cy.get('[data-cy="save-new-question"]').click({force: true});
 
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText("NUMERICAL - " + questionTitle).parent().parent().parent().parent().parent().parent().children().eq(0).contains('NUMERICAL'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="input-numerical-minimum"]').contains('Min: 0');
    cy.get('[data-cy="input-numerical-maximum"]').contains('Max: 100');
  }),
 
  it('8. Adding a Free Text question to pool', () => {
    const randomQuestionNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Free Text ' + randomQuestionNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomQuestionNumber;
 
    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="select-question-type"]').click();
    cy.findAllByText('Freitext (FT)').eq(1).click(); // TODO Don't know how this could work with data-cy
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="set-free-text-length"]').click().type('100');
    cy.get('[data-cy="save-new-question"]').click({force: true});
 
    cy.get('[data-cy="question-block"]').contains(questionTitle).should('exist');
    cy.findByText("FREE_TEXT - " + questionTitle).parent().parent().parent().parent().parent().parent().children().eq(0).contains('FREE_TEXT'); // TODO Not yet linkable to question title, thats why we have to go with parent()
    cy.get('[data-cy="question-block"]').contains(question).should('exist');
    cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
    cy.get('[data-cy="free-text-response-input"]').should('exist');
  }),
 
  it('9. Workflow of running a session and answering questions', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const session = 'Displayed Name ' + randomNumber;
    const sessionTitle = 'Test Session ' + randomNumber;
    const questionTitle = 'A Single Choice ' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type('25%');
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});


    // step 1
    cy.get('[data-cy="insert-live-session-name"]').type(sessionTitle);
    cy.get('[data-cy="insert-live-display-name"]').type(session);
    cy.get('[data-cy="next-or-submit"]').click();

    // step 2
    cy.get('[data-cy="select-course"]').should('exist').contains('Kein Kurs');
    cy.get('[data-cy="select-course"]').click().siblings().eq(0).findByText('Testkurs').parent().click();
    cy.get('[data-cy="select-course"]').contains('Testkurs');
    cy.get('[data-cy="select-multiplier"]').should('exist').contains('Einfach (1x)'); 
    cy.get('[data-cy="select-multiplier"]').click().siblings().eq(0).findByText('Doppelt (2x)').parent().click();
    cy.get('[data-cy="select-multiplier"]').contains('Doppelt (2x)'); 
    cy.get('[data-cy="set-gamification"]').should('not.be.checked');
    cy.get('[data-cy="set-gamification"]').click();
    // cy.get('[data-cy="set-gamification"]').should('be.checked'); // TODO: This does not work properly as it should be checked after a click
    cy.get('[data-cy="next-or-submit"]').click();
  
    // step 3
    for (let i = 0; i < 2; i++) {
      const dataTransfer = new DataTransfer();
      cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
        dataTransfer
      });
      cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
        dataTransfer
      });  
    }

    cy.get('[data-cy="add-block"]').click();
    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
      dataTransfer
    });
    cy.get('[data-cy="drop-questions-here"]').eq(1).trigger('drop', {
      dataTransfer
    });    
    cy.get('[data-cy="next-or-submit"]').click();

    cy.get('[data-cy="load-session-list"]').click();
    cy.get('[data-cy="session"]').contains(sessionTitle);

    // start session and first block
    cy.findByText(sessionTitle).parentsUntil('[data-cy="session"]').find('[data-cy="start-session"]').click();
    cy.get('[data-cy="interaction-first-block"]').click();
     
    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('[data-cy="username-field"]').click().type('testuser1');
    cy.get('[data-cy="password-field"]').click().type('testing');
    cy.get('[data-cy="submit-login"]').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    cy.get('[data-cy="student-submit-answer"]').click();
    cy.findByText('25%').click();
    cy.get('[data-cy="student-submit-answer"]').click();
    cy.wait(500);

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data-cy="submit-login"]').click();
    cy.get('[data-cy="sessions"]').click();
    cy.findByText(sessionTitle).parentsUntil('[data-cy="session"]').find('[data-cy="session-cockpit"]').click();
    cy.wait(1000);

    // close first block
    cy.get('[data-cy="interaction-first-block"]').click();
    cy.wait(500);
    // start next block
    cy.get('[data-cy="interaction-first-block"]').click();
    cy.wait(500);

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_STUDENT'));
    cy.get('[data-cy="username-field"]').type('testuser1');
    cy.get('[data-cy="password-field"]').type('testing');
    cy.get('[data-cy="submit-login"]').click();
    cy.findByText(session).click();
    cy.findByText('25%').click();
    cy.get('[data-cy="student-submit-answer"]').click();
    cy.wait(500);

    cy.clearAllCookies();
    cy.visit(Cypress.env('URL_LECTURER'));
    cy.get('[data-cy="email-field"]').type('lecturer@bf.uzh.ch');
    cy.get('[data-cy="password-field"]').type('abcd');
    cy.get('[data-cy="submit-login"]').click();
    cy.get('[data-cy="sessions"]').click();
    cy.findByText(sessionTitle).parentsUntil('[data-cy="session"]').find('[data-cy="session-cockpit"]').click();
    cy.wait(1000);
    cy.get('[data-cy="interaction-first-block"]').click();
    
    cy.url().then(url => {
      const sessionIdEvaluation = url.split('/')[4];
      cy.visit(Cypress.env('URL_LECTURER') + '/sessions/' + sessionIdEvaluation + '/evaluation');
    });

  // TODO: bugfix: evaluation is broken - does not fetch any answers. Once fixed, write better checks
  //  cy.get('[data-cy="session-total-participants"]').should('have.text', 'Total Teilnehmende: 1');
  //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    cy.get('[data-cy="evaluate-next-question"]').click();
  //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
  //   cy.get('[data-cy="evaluate-next-question"]').click();
  //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
}),

  it('10. Create and publish a learning element', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice with solution' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;
    const learningElementName = 'Test Lernelement ' + randomNumber;
    const learningElementDisplayName = 'Displayed Name ' + randomNumber;
    const description = 'This is the official descriptioin of ' + randomNumber

    // set up question with solution
    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="configure-sample-solution"]').click();
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="set-correctness"]').click({force: true});
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
    // 
    // create learning element
    cy.get('[data-cy="create-learning-element"]').click();
    // 
    // step 1
    cy.get('[data-cy="insert-learning-element-name"]').click().type(learningElementName);
    cy.get('[data-cy="insert-learning-element-display-name"]').click().type(learningElementDisplayName);
    cy.get('[data-cy="insert-learning-element-description"]').click().type(description)
    cy.get('[data-cy="next-or-submit"]').click();

    // step 2
    cy.get('[data-cy="select-course"]').should('exist').contains("Testkurs");
    cy.get('[data-cy="select-multiplier"]').should('exist').contains('Einfach (1x)'); 
    cy.get('[data-cy="select-multiplier"]').click().siblings().eq(0).findByText('Doppelt (2x)').parent().click();
    cy.get('[data-cy="select-multiplier"]').contains('Doppelt (2x)'); 
    cy.get('[data-cy="insert-reset-time-days"]').clear().type('4');
    cy.get('[data-cy="select-order"]').should('exist').contains('Sequenziell'); 
    cy.get('[data-cy="select-order"]').click().siblings().eq(0).findByText('Zufällig').parent().click();
    cy.get('[data-cy="select-order"]').contains('Zufällig');
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
      dataTransfer
    });
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer
    });
    cy.get('[data-cy="next-or-submit"]').click();

    cy.get('[data-cy="load-session-list"]').click();
    cy.get('[data-cy="learning-element"]').contains(learningElementName);
    cy.findByText(learningElementName).parentsUntil('[data-cy="learning-element"]').contains('Draft');

    // publish learning element
    cy.findByText(learningElementName).parentsUntil('[data-cy="learning-element"]').find('[data-cy="publish-learning-element"]').click();
    cy.get('[data-cy="verify-publish-action"]').click()
    cy.findByText(learningElementName).parentsUntil('[data-cy="learning-element"]').contains('Published');

    // TODO: open learning element from student view and answer 1 question once bug is fixed (questions for learning elements are not fetched correctly)
  }),

  it('11. Create and publish a micro session', () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const questionTitle = 'A Single Choice with solution' + randomNumber;
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;
    const microSessionName = 'Test Micro-Session ' + randomNumber;
    const microSessionDisplayName = 'Displayed Name ' + randomNumber;
    const description = 'This is the official descriptioin of ' + randomNumber

    // set up question
    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="configure-sample-solution"]').click();
    cy.get('[data-cy="insert-answer-field"]').click().type('50%');
    cy.get('[data-cy="set-correctness"]').click({force: true});
    cy.get('[data-cy="add-new-answer"]').click({force: true});
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
    cy.get('[data-cy="save-new-question"]').click({force: true});
    // 
    // create a micro-session
    cy.get('[data-cy="create-micro-session"]').click();
    // 
    // step 1
    cy.get('[data-cy="insert-micro-session-name"]').click().type(microSessionName);
    cy.get('[data-cy="insert-micro-session-display-name"]').click().type(microSessionDisplayName);
    cy.get('[data-cy="insert-micro-session-description"]').click().type(description)
    cy.get('[data-cy="next-or-submit"]').click();

    // step 2
    cy.get('[data-cy="select-course"]').should('exist').contains("Testkurs"); 
    cy.get('[data-cy="select-start-date"]').click().type("2024-01-01T18:00");
    cy.get('[data-cy="select-end-date"]').click().type("2024-12-31T18:00");
    cy.get('[data-cy="select-multiplier"]').should('exist').contains('Einfach (1x)'); 
    cy.get('[data-cy="select-multiplier"]').click().siblings().eq(0).findByText('Doppelt (2x)').parent().click();
    cy.get('[data-cy="select-multiplier"]').contains('Doppelt (2x)');
    cy.get('[data-cy="next-or-submit"]').click()

    // step 3
    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
      dataTransfer
    });
    cy.get('[data-cy="drop-questions-here"]').trigger('drop', {
      dataTransfer
    });
    cy.get('[data-cy="next-or-submit"]').click();

    cy.get('[data-cy="load-session-list"]').click();
    cy.get('[data-cy="micro-session"]').contains(microSessionName);
    cy.findByText(microSessionName).parentsUntil('[data-cy="micro-session"]').contains('Draft');

    // publish a micro-session
    cy.findByText(microSessionName).parentsUntil('[data-cy="micro-session"]').siblings().children().get('[data-cy="publish-micro-session"]').contains('Micro-Session veröffentlichen').click();
    cy.get('[data-cy="verify-publish-action"]').click()
    cy.findByText(microSessionName).parentsUntil('[data-cy="micro-session"]').contains('Published');
  })

})
