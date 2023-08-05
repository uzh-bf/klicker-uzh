import { performLecturerLogin } from "./login-workflow.cy";

describe("Create questions", () => {
  beforeEach(() => {
    performLecturerLogin(cy);
  }),
    it("creates a single choice question", () => {
      const randomQuestionNumber = Math.round(Math.random() * 1000);
      const questionTitle = "A Single Choice " + randomQuestionNumber;
      const question =
        "Was ist die Wahrscheinlichkeit? " + randomQuestionNumber;

      cy.get('[data-cy="create-question"]').click();
      cy.get('[data-cy="insert-question-title"]').type(questionTitle);
      cy.get('[data-cy="insert-question-text"]').click().type(question);
      cy.get('[data-cy="insert-answer-field"]').click().type("50%");
      cy.get('[data-cy="add-new-answer"]').click({ force: true });
      cy.get('[data-cy="insert-answer-field"]').eq(1).click().type("100%");
      cy.get('[data-cy="save-new-question"]').click({ force: true });

      cy.contains('[data-cy="question-block"]', question);
      cy.contains('[data-cy="question-block"]', questionTitle);
      cy.findByText("SC - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="question-title"]')
        .contains("SC");
      cy.findByText("SC - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="edit-question"]')
        .click();
      cy.get('[data-cy="sc-answer-options"]').should("have.length", 2);
    }),
    it("creates a multiple choice question", () => {
      const randomQuestionNumber = Math.round(Math.random() * 1000);
      const questionTitle = "A Multiple Choice " + randomQuestionNumber;
      const question =
        "Was ist die Wahrscheinlichkeit? " + randomQuestionNumber;

      cy.get('[data-cy="create-question"]').click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Single Choice (SC)");
      cy.get('[data-cy="select-question-type"]')
        .click()
        .siblings()
        .findByText("Multiple Choice (MC)")
        .click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Multiple Choice (MC)");
      cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
      cy.get('[data-cy="insert-question-text"]').click().type(question);
      cy.get('[data-cy="insert-answer-field"]').click().type("50%");
      cy.get('[data-cy="add-new-answer"]').click({ force: true });
      cy.get('[data-cy="insert-answer-field"]').eq(1).click().type("100%");
      cy.get('[data-cy="save-new-question"]').click({ force: true });

      cy.contains('[data-cy="question-block"]', question);
      cy.contains('[data-cy="question-block"]', questionTitle);
      cy.findByText("MC - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="question-title"]')
        .contains("MC");
      cy.findByText("MC - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="edit-question"]')
        .click();
      cy.get('[data-cy="sc-answer-options"]').should("have.length", 2);
    }),
    it("creates a KPRIM question", () => {
      const randomQuestionNumber = Math.round(Math.random() * 1000);
      const questionTitle = "A KPRIM " + randomQuestionNumber;
      const question =
        "Was ist die Wahrscheinlichkeit? " + randomQuestionNumber;

      cy.get('[data-cy="create-question"]').click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Single Choice (SC)");
      cy.get('[data-cy="select-question-type"]')
        .click()
        .siblings()
        .findByText("KPRIM (KP)")
        .click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("KPRIM (KP)");
      cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
      cy.get('[data-cy="insert-question-text"]').click().type(question);
      cy.get('[data-cy="insert-answer-field"]').click().type("50%");
      cy.get('[data-cy="add-new-answer"]').click({ force: true });
      cy.get('[data-cy="insert-answer-field"]').eq(1).click().type("100%");
      cy.get('[data-cy="save-new-question"]').click({ force: true });

      cy.contains('[data-cy="question-block"]', questionTitle);
      cy.contains('[data-cy="question-block"]', question);
      cy.findByText("KPRIM - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="question-title"]')
        .contains("KPRIM");
      cy.findByText("KPRIM - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="edit-question"]')
        .click();
      // cy.get('[data-cy="edit-question"]').first().click(); // TODO Risky at the moment, but no problem once we work with empty database before every test
      cy.get('[data-cy="sc-answer-options"]').should("have.length", 2);
    }),
    it("creates a Numeric question", () => {
      const randomQuestionNumber = Math.round(Math.random() * 1000);
      const questionTitle = "A Numeric " + randomQuestionNumber;
      const question =
        "Was ist die Wahrscheinlichkeit? " + randomQuestionNumber;

      cy.get('[data-cy="create-question"]').click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Single Choice (SC)");
      cy.get('[data-cy="select-question-type"]')
        .click()
        .siblings()
        .findByText("Numerisch (NR)")
        .click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Numerisch (NR)");
      cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
      cy.get('[data-cy="insert-question-text"]').click().type(question);
      cy.get('[data-cy="set-numerical-minimum"]').click().type("0");
      cy.get('[data-cy="set-numerical-maximum"]').click().type("100");
      cy.get('[data-cy="save-new-question"]').click({ force: true });

      cy.contains('[data-cy="question-block"]', questionTitle);
      cy.contains('[data-cy="question-block"]', question);
      cy.findByText("NUMERICAL - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="question-title"]')
        .contains("NUMERICAL");
      cy.findByText("NUMERICAL - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="edit-question"]')
        .click();
      cy.get('[data-cy="input-numerical-minimum"]').contains("Min: 0");
      cy.get('[data-cy="input-numerical-maximum"]').contains("Max: 100");
    }),
    it("creates a Free Text question", () => {
      const randomQuestionNumber = Math.round(Math.random() * 1000);
      const questionTitle = "A Free Text " + randomQuestionNumber;
      const question =
        "Was ist die Wahrscheinlichkeit? " + randomQuestionNumber;

      cy.get('[data-cy="create-question"]').click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Single Choice (SC)");
      cy.get('[data-cy="select-question-type"]')
        .click()
        .siblings()
        .findByText("Freitext (FT)")
        .click();
      cy.get('[data-cy="select-question-type"]')
        .should("exist")
        .contains("Freitext (FT)");
      cy.get('[data-cy="insert-question-title"]').click().type(questionTitle);
      cy.get('[data-cy="insert-question-text"]').click().type(question);
      cy.get('[data-cy="set-free-text-length"]').click().type("100");
      cy.get('[data-cy="save-new-question"]').click({ force: true });

      cy.contains('[data-cy="question-block"]', questionTitle);
      cy.contains('[data-cy="question-block"]', question);
      cy.findByText("FREE_TEXT - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="question-title"]')
        .contains("FREE_TEXT");
      cy.findByText("FREE_TEXT - " + questionTitle)
        .parentsUntil('[data-cy="question-block"]')
        .find('[data-cy="edit-question"]')
        .click();
      cy.get('[data-cy="free-text-response-input"]').should("exist");
    });

  it("creates a new question, duplicates it and then deletes the duplicate again", () => {
    const randomNumber = Math.round(Math.random() * 1000);
    const questionTitle = "A Single Choice " + randomNumber;
    const question = "Was ist die Wahrscheinlichkeit? " + randomNumber;

    cy.get('[data-cy="create-question"]').click();
    cy.get('[data-cy="insert-question-title"]').type(questionTitle);
    cy.get('[data-cy="insert-question-text"]').click().type(question);
    cy.get('[data-cy="insert-answer-field"]').click().type("50%");
    cy.get('[data-cy="add-new-answer"]').click({ force: true });
    cy.get('[data-cy="insert-answer-field"]').eq(1).click().type("100%");
    cy.get('[data-cy="save-new-question"]').click({ force: true });

    // duplicate question and save
    cy.get(`[data-cy="duplicate-question-${questionTitle}"]`).click();
    cy.findByText("Frage duplizieren").should("exist");
    cy.get('[data-cy="save-new-question"]').click({ force: true });

    // check if duplicated question exists alongside original question
    cy.get('[data-cy="question-block"]')
      .contains(questionTitle)
      .should("exist");
    cy.get('[data-cy="question-block"]')
      .contains(questionTitle + " (Copy)")
      .should("exist");

    // delete the duplicated question
    cy.get(`[data-cy="delete-question-${questionTitle} (Copy)"]`).click();
    cy.get('[data-cy="confirm-question-deletion"]').click();
    cy.get('[data-cy="question-block"]')
      .contains(questionTitle)
      .should("exist");
    cy.get('[data-cy="question-block"]')
      .contains(questionTitle + " (Copy)")
      .should("not.exist");
  });
});
