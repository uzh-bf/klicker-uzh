import { performLecturerLogin } from "./login-workflow.cy";

describe("Test functionalities of frontend-control application", () => {
  it("Test the basic functionalities of the control application: login and session management", () => {
    // log into frontend-manage
    performLecturerLogin(cy);

    // create a new session with one question for testing
    const randomNumber = Math.round(Math.random() * 1000);
    const questionTitle = "A Single Choice " + randomNumber;
    const question = "Was ist die Wahrscheinlichkeit? " + randomNumber;
    const sessionTitle = "Test Session " + randomNumber;
    const session = "Displayed Test Session Name " + randomNumber;
    const course = "Testkurs";

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type("50%");
    cy.get('[data-cy="add-new-answer"]').click({ force: true });
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type("100%");
    cy.get('[data-cy="save-new-question"]').click({ force: true });

    cy.get('[data-cy="create-live-session"]').click();
    cy.get('[data-cy="insert-live-session-name"]').type(sessionTitle);
    cy.get('[data-cy="insert-live-display-name"]').type(session);
    cy.get('[data-cy="next-or-submit"]').click();
    cy.get('[data-cy="next-or-submit"]').click();

    const dataTransfer = new DataTransfer();
    cy.get('[data-cy="question-block"]')
      .contains(questionTitle)
      .trigger("dragstart", {
        dataTransfer,
      });
    cy.get('[data-cy="drop-questions-here"]').trigger("drop", {
      dataTransfer,
    });
    cy.get('[data-cy="next-or-submit"]').click();

    cy.get('[data-cy="load-session-list"]').click();
    cy.contains('[data-cy="session-block"]', sessionTitle);

    // generate a token to log into the control-frontend
    cy.get('[data-cy="user-menu"]').click();
    cy.get('[data-cy="token-generation-page"]').click();
    cy.get('[data-cy="generate-token"]').click();

    // save the token
    cy.get('[data-cy="control-login-token"]')
      .invoke("text")
      .then(($token) => {
        cy.wrap($token).as("token");
      });

    // log into the control-frontend application
    cy.clearAllCookies();
    cy.visit(Cypress.env("URL_CONTROL"));
    cy.viewport("macbook-16");
    cy.get('[data-cy="login-logo"]').should("exist");
    cy.get('[data-cy="email-field"]').type(Cypress.env("LECTURER_EMAIL"));
    cy.get("@token").then((token) => {
      cy.get('[data-cy="token-field"]').type(String(token));
    });
    cy.get('[data-cy="submit-login"]').click();

    cy.get('[data-cy="unassigned-sessions"]').click();

    // check ppt links and start the session
    cy.findByText(sessionTitle).then(($parentDiv) => {
      const sessionDiv = $parentDiv.parent().parent();
      cy.wrap(sessionDiv).findByText("PPT").click();
    });
    cy.get('[data-cy="close-embedding-modal"]').click();

    cy.findByText(sessionTitle).click();
    cy.get('[data-cy="confirm-start-session"]').click();

    // test the mobile menu of the control app
    // resize the window to a mobile size
    cy.viewport("iphone-6");
    cy.get('[data-cy="ppt-button"]').click();
    cy.get('[data-cy="close-embedding-modal"]').click();
    cy.get('[data-cy="home-button"]').click();
    cy.get('[data-cy="unassigned-sessions"]').click();
    cy.findByText(sessionTitle).click();
    cy.get('[data-cy="back-button"]').click();
    cy.findByText(sessionTitle).click();
    cy.viewport("macbook-16");

    // open and close the block and end the session
    cy.get('[data-cy="activate-next-block"]').click();
    cy.get('[data-cy="deactivate-block"]').click();
    cy.get('[data-cy="end-session"]').click();
    cy.findByText(sessionTitle).should("not.exist");

    // TODO (later): check if session is running correctly / add student answer
  });
});
