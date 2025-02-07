import messages from '../../../packages/i18n/messages/en'

describe('Create different types of elements (with and without sample solution) and edit them', function () {
  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('D-questions.json').then((data) => {
      this.data = data
    })
  })

  // ! Part 1: Question duplication
  // #region
  it('Create a new question, duplicates it and then deletes them again', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(
      this.data.duplication.title
    )
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.duplication.content)
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // duplicate question and save
    cy.get(
      `[data-cy="duplicate-question-${this.data.duplication.title}"]`
    ).click()
    cy.wait(500)
    cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // check if duplicated question exists alongside original question
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('exist')
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).contains(messages.shared.DRAFT.statusLabel)

    // delete the created and duplicated question
    cy.get(
      `[data-cy="delete-question-${this.data.duplication.title} (Copy)"]`
    ).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="element-item-${this.data.duplication.title + ' (Copy)'}"]`
    ).should('not.exist')
    cy.get(`[data-cy="delete-question-${this.data.duplication.title}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${this.data.duplication.title}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! Part 2: Auto-Save functionality for Elements
  // #region
  function enterSCQuestionContent(data) {
    cy.get('[data-cy="insert-question-title"]').type(data.autoSave.title)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(data.autoSave.content)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(data.autoSave.choices[0].content)
    cy.wrap(data.autoSave.choices.slice(1)).each(
      (choice: { content: string }, ix) => {
        cy.get('[data-cy="add-new-answer"]').click()
        cy.wait(500)
        cy.get(`[data-cy="insert-answer-field-${ix + 1}"]`)
          .realClick()
          .type(choice.content)
      }
    )
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.wrap(data.autoSave.choices).each((choice: { correct?: boolean }, ix) => {
      if (choice.correct) {
        cy.get(`[data-cy="set-correctness-${ix}"]`).click()
      }
    })
  }

  it('Verify that empty questions are not stored in local storage (creation)', function () {
    // open modal, wait for auto-save, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.wait(3000) // wait longer than auto-save requires
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="select-question-type"]').contains(
      messages.shared.SC.typeLabel
    )
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that non-empty questions are stored and loaded correctly on demand (creation)', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // re-open modal, load data, verify content, close modal
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.autoSave.content)
    cy.wrap(this.data.autoSave.choices).each(
      (choice: { content: string }, ix) => {
        cy.get(`[data-cy="insert-answer-field-${ix}"]`).contains(choice.content)
      }
    )
  })

  it('Verify that non-empty questions are stored and discarded on request (creation)', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that local storage is correctly cleared after creating a question', function () {
    cy.get('[data-cy="create-question"]').click()

    // create SC question with content
    enterSCQuestionContent(this.data)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // check that local storage is cleared correctly on save and new editor is empty
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should('have.value', '')
  })

  it('Verify that opening the edit modal and closing without modifications does not trigger prompt', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
  })

  it('Verify that after editing a question and waiting for auto-save the corresponding content can be loaded', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & load data, verify updated content is visible
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that after editing a question, auto-saving and discarding the saved content, the original content is loaded', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // recovery prompt should not be shown & discard data, verify original content is visible
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.wait(3000)
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that when closing and opening now after discarding, no prompt is shown
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()
    cy.get('[data-cy="discard-recovered-element-data"]').should('not.exist')
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that after editing an element and saving it, no prompt is shown to the user', function () {
    cy.get(`[data-cy="edit-question-${this.data.autoSave.title}"]`).click()

    // modify title and content
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.title
    )
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.autoSave.titleEdited)
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.content
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="save-new-question"]').click()

    // recovery prompt should not be shown, verify edited content is visible
    cy.get(
      `[data-cy="edit-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
  })

  it('Verify that when duplicating a question, wating for auto-save and opening the creation form, the content cannot be loaded', function () {
    cy.get(
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited
    )
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').should('not.exist')
  })

  it('Verify that when duplicating a question, modifying it slightly,wating for auto-save and opening the creation form, the content can be loaded', function () {
    cy.get(
      `[data-cy="duplicate-question-${this.data.autoSave.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.autoSave.contentEdited2)
    cy.wait(3000) // wait for auto-save to trigger
    cy.get('[data-cy="close-element-modal"]').click()

    // verify that the duplicated
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="load-recovered-element-data"]').click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.autoSave.titleEditedDuplicated
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.autoSave.contentEdited2
    )
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete the auto-saved element', function () {
    cy.deleteElement({ elementName: this.data.autoSave.titleEdited })
  })

  it('Verify that all answer collections have been deleted successfully', function () {
    // validate that no collections except from the seeded ones remain
    cy.task('verifyDeletionAnswerCollections').then((result) => {
      // check if the verification was successful
      if (result === null || result === false) {
        throw new Error(
          'The database contains answer collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion
})
