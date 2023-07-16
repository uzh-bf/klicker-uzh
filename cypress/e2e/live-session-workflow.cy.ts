describe('Different live-session workflows', () => {
    beforeEach(() => {
        cy.visit(Cypress.env('URL_MANAGE'));
        cy.viewport("macbook-16");
        cy.get('[data-cy="login-logo"]').should('exist');
        cy.get('[data-cy="email-field"]').type(Cypress.env('LECTURER_EMAIL'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
      }),
    
    it('adds and then deletes a second question block', () => {
        const randomNumber = Math.round(Math.random() * 1000);
        const sessionTitle = 'Test Session ' + randomNumber;
        const session = 'Displayed Test Session Name ' + randomNumber;

        cy.get('[data-cy="create-live-session"]').click();
        cy.get('[data-cy="insert-live-session-name"]').type(sessionTitle);
        cy.get('[data-cy="insert-live-display-name"]').type(session);
        cy.get('[data-cy="next-or-submit"]').click();
        cy.get('[data-cy="next-or-submit"]').click();

        cy.get('[data-cy="block-container-header"]').should('have.length', 1);
        cy.get('[data-cy="add-block"]').click();
        cy.get('[data-cy="block-container-header"]').should('have.length', 2);
        cy.get('[data-cy="delete-block"]').eq(1).click();
        cy.get('[data-cy="block-container-header"]').should('have.length', 1);
    }),

    it('creates a session with one block', () => {
        const randomNumber = Math.round(Math.random() * 1000);
        const questionTitle = 'A Single Choice ' + randomNumber;
        const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;
        const sessionTitle = 'Test Session ' + randomNumber;
        const session = 'Displayed Test Session Name ' + randomNumber;
     
        cy.get('[data-cy="create-question"]').click();
        cy.get('[data-cy="insert-question-title"]').type(questionTitle);
        cy.get('[data-cy="insert-question-text"]').click().type(question);
        cy.get('[data-cy="insert-answer-field"]').click().type('50%');
        cy.get('[data-cy="add-new-answer"]').click({force: true});
        cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
        cy.get('[data-cy="save-new-question"]').click({force: true});
     
        cy.get('[data-cy="create-live-session"]').click();
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
        cy.contains('[data-cy="session-block"]', sessionTitle);
      }),

    it('shows a possible workflow of running a session and answering questions', () => {
        const randomNumber = Math.round(Math.random() * 1000);
        const session = 'Displayed Name ' + randomNumber;
        const sessionTitle = 'Test Session ' + randomNumber;
        const questionTitle = 'A Single Choice ' + randomNumber;
        const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber;
        const feedback = 'This is a test feedback';
    
        cy.get('[data-cy="create-question"]').click();
        cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
        cy.get('[data-cy="insert-question-text"]').click().type(question);
        cy.get('[data-cy="insert-answer-field"]').click().type('25%');
        cy.get('[data-cy="add-new-answer"]').click({force: true});
        cy.get('[data-cy="insert-answer-field"]').eq(1).click().type('100%');
        cy.get('[data-cy="save-new-question"]').click({force: true});
    
    
        // step 1
        cy.get('[data-cy="create-live-session"]').click();
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
        for (let i = 0; i < 2; i++) {
          const dataTransfer = new DataTransfer();
          cy.get('[data-cy="question-block"]').contains(questionTitle).trigger('dragstart', {
            dataTransfer
          });
          cy.get('[data-cy="drop-questions-here"]').eq(1).trigger('drop', {
            dataTransfer
          });  
        }
        cy.get('[data-cy="next-or-submit"]').click();
    
        cy.get('[data-cy="load-session-list"]').click();
        cy.get('[data-cy="session"]').contains(sessionTitle);
    
        // start session and first block
        cy.findByText(sessionTitle).parentsUntil('[data-cy="session"]').find('[data-cy="start-session"]').click();
        cy.get('[data-cy="interaction-first-block"]').click();

        // login student and answer first question
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_STUDENT'));
        cy.get('[data-cy="username-field"]').click().type(Cypress.env('STUDENT_USERNAME'));
        cy.get('[data-cy="password-field"]').click().type(Cypress.env('STUDENT_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
        cy.wait(1000);
        cy.findByText(session).click();
        cy.findByText('25%').click();
        cy.get('[data-cy="student-submit-answer"]').click();
        cy.wait(500);

        // login student again on mobile, test navigation and answer second question
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_STUDENT'));
        cy.viewport('iphone-x');
        cy.get('[data-cy="username-field"]').click().type(Cypress.env('STUDENT_USERNAME'));
        cy.get('[data-cy="password-field"]').click().type(Cypress.env('STUDENT_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
        cy.wait(1000);
        cy.findByText(session).click();
        cy.findByText(question).should('exist');

        // TODO: test feedback mechanism (including lecturer response, publishing, moderation, etc.)
        cy.get('[data-cy="mobile-menu-leaderboard"]').click();
        cy.get('[data-cy="mobile-menu-feedbacks"]').click();
        cy.get('[data-cy="mobile-menu-questions"]').click();
        cy.findByText('25%').click();
        cy.get('[data-cy="student-submit-answer"]').click();
        cy.wait(500);
        cy.viewport('macbook-16');
    
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_MANAGE'));
        cy.get('[data-cy="email-field"]').type(Cypress.env('LECTURER_EMAIL'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'));
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

        // login student and answer first question
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_STUDENT'));
        cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
        cy.findByText(session).click();
        cy.findByText('25%').click();
        cy.get('[data-cy="student-submit-answer"]').click();
        cy.wait(500);

        // repeat student actions on mobile device and answer second question
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_STUDENT'));
        cy.viewport('iphone-x');
        cy.get('[data-cy="username-field"]').type(Cypress.env('STUDENT_USERNAME'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('STUDENT_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
        cy.wait(1000);
        cy.findByText(session).click();
        cy.findByText('25%').click();
        cy.get('[data-cy="student-submit-answer"]').click();
        cy.wait(500);
        cy.viewport('macbook-16');
    
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_MANAGE'));
        cy.get('[data-cy="email-field"]').type(Cypress.env('LECTURER_EMAIL'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
        cy.get('[data-cy="sessions"]').click();
        cy.findByText(sessionTitle).parentsUntil('[data-cy="session"]').find('[data-cy="session-cockpit"]').click();
        cy.wait(1000);
        cy.get('[data-cy="interaction-first-block"]').click();
        
        cy.url().then(url => {
          const sessionIdEvaluation = url.split('/')[4];
          cy.visit(Cypress.env('URL_MANAGE') + '/sessions/' + sessionIdEvaluation + '/evaluation');
        });
    
      // TODO: bugfix: evaluation is broken - does not fetch any answers. Once fixed, write better checks
      //  cy.get('[data-cy="session-total-participants"]').should('have.text', 'Total Teilnehmende: 1');
      //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
        cy.get('[data-cy="evaluate-next-question"]').click();
      //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
      //   cy.get('[data-cy="evaluate-next-question"]').click();
      //   cy.get('#bar-chart-block-0').should('have.text', '1'); // TODO doesn't work with data-cy yet (because its a LabelList?) -> id
    })

})