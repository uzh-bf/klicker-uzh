describe('Different learning element workflows', () => {
    beforeEach(() => {
        cy.visit(Cypress.env('URL_LECTURER'));
        cy.get('[data-cy="login-logo"]').should('exist');
        cy.get('[data-cy="email-field"]').type(Cypress.env('LECTURER_EMAIL'));
        cy.get('[data-cy="password-field"]').type(Cypress.env('LECTURER_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();
    }),

    it('creates and publishes a learning element', () => {
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
        
        // create learning element
        cy.get('[data-cy="create-learning-element"]').click();
            
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

        // sign in as student
        cy.clearAllCookies();
        cy.visit(Cypress.env('URL_STUDENT'));
        cy.get('[data-cy="username-field"]').click().type(Cypress.env('STUDENT_USERNAME'));
        cy.get('[data-cy="password-field"]').click().type(Cypress.env('STUDENT_PASSWORD'));
        cy.get('[data-cy="submit-login"]').click();

        cy.findByText('Repetition').click();
        cy.get('[data-cy="repetition-element"]').contains(learningElementDisplayName).click();
        cy.get('[data-cy="start-learning-element"]').click();
        // TODO: answer one question once bug is fixed (questions in learning elements are currently not correctly fetched)
    })
})