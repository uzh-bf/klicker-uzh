import messages from '../../../packages/i18n/messages/en'

describe('Create, edit and share answer collections', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('K-resources.json').then((data) => {
      this.data = data
    })
  })

  function validateDatabaseContent() {
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
  }

  function deleteAnswerCollection({ name }: { name: string }) {
    cy.get(`[data-cy="answer-collection-${name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${name}"]`).should('not.exist')
  }

  function removeAnswerCollection({ name }: { name: string }) {
    cy.get(`[data-cy="answer-collection-${name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
  }

  // ! Creation and editing of answer collections
  // #region
  it('Create a public answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').should('exist')
    cy.get('[data-cy="cancel-create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').should('not.exist')
    cy.get('[data-cy="create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').type(this.data.public.name)
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.public.name
    )

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPRIVATE
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-public"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )

    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .type(this.data.public.description)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.public.description)

    cy.get('[data-cy="response-entry-0"]').type(this.data.public.items[0])
    cy.get('[data-cy="response-entry-0"]').should(
      'have.value',
      this.data.public.items[0]
    )
    cy.get('[data-cy="response-entry-1"]').type(this.data.public.items[1])
    cy.get('[data-cy="response-entry-1"]').should(
      'have.value',
      this.data.public.items[1]
    )
    cy.wrap(this.data.public.items.slice(2)).each((value: string, ix) => {
      cy.get('[data-cy="add-response-entry"]').click()
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).type(value)
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).should('have.value', value)
    })

    // test deletion of answer option
    cy.get(
      `[data-cy="response-entry-${this.data.public.items.length - 1}"]`
    ).should('exist')
    cy.get('[data-cy="remove-response-entry-3"]').click()
    cy.get(
      `[data-cy="response-entry-${this.data.public.items.length - 1}"]`
    ).should('not.exist')
    cy.get(`[data-cy="response-entry-3"]`).should(
      'have.value',
      this.data.public.items[4]
    )
    cy.get('[data-cy="submit-create-answer-collection"]').should(
      'not.be.disabled'
    )

    // verify that duplicated answer options are not accepted
    cy.get('[data-cy="add-response-entry"]').click()
    cy.get(
      `[data-cy="response-entry-${this.data.public.items.length - 1}"]`
    ).type(this.data.public.items[0])
    cy.get(
      `[data-cy="response-entry-${this.data.public.items.length - 1}"]`
    ).should('have.value', this.data.public.items[0])
    cy.get(
      `[data-cy="remove-response-entry-${this.data.public.items.length - 1}"]`
    ).click()
    cy.get(
      `[data-cy="response-entry-${this.data.public.items.length - 1}"]`
    ).should('not.exist')

    cy.get('[data-cy="submit-create-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).contains(
      messages.manage.resources.accessPUBLIC
    )
  })

  it('Create a restricted answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.restricted.name,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: this.data.restricted.description,
      entries: this.data.restricted.items,
    })
  })

  it('Create a private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.private.name,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: this.data.private.description,
      entries: this.data.private.items,
    })
  })

  it('Edit the private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.private.name
    )
    cy.get('[data-cy="answer-collection-name"]')
      .clear()
      .type(this.data.private.nameNew)
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.private.nameNew
    )

    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.private.description)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .clear()
      .type(this.data.private.descriptionNew)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.private.descriptionNew)
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    // check that current values are correct
    cy.wrap(this.data.private.items).each((value: string) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })

    // verify validation for editing answer options
    cy.get(
      `[data-cy="edit-answer-option-${this.data.private.items[0]}"]`
    ).click()
    cy.get(`[data-cy="edit-answer-option-input"]`).should(
      'have.value',
      this.data.private.items[0]
    )

    cy.get(`[data-cy="save-edit-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.private.items[1]) // duplicate answer options not allowed
    cy.get(`[data-cy="save-edit-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.private.items[0])
    cy.get(`[data-cy="save-edit-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`).clear() // empty options are not allowed
    cy.get(`[data-cy="save-edit-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.private.items[0])
    cy.get(`[data-cy="save-edit-answer-option"]`).click()

    // change all answer option values
    cy.wrap(this.data.private.items).each((value: string, ix) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).click()
      cy.get(`[data-cy="edit-answer-option-input"]`).should('have.value', value)
      cy.get(`[data-cy="edit-answer-option-input"]`)
        .clear()
        .type(this.data.private.itemsNew[ix])
      cy.get(`[data-cy="save-edit-answer-option"]`).click()
      cy.get(
        `[data-cy="answer-option-${this.data.private.itemsNew[ix]}"]`
      ).contains(this.data.private.itemsNew[ix])
    })

    // verify validation for newly added answer options and add new answer option
    const existingElement = this.data.private.itemsNew[0]
    const lastElement =
      this.data.private.itemsNew[this.data.private.itemsNew.length - 1]
    cy.get(`[data-cy="delete-answer-option-${lastElement}"]`).click()
    cy.get(`[data-cy="answer-option-${lastElement}"]`).should('not.exist')
    cy.get(`[data-cy="add-answer-option"]`).click()
    cy.get(`[data-cy="save-new-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="input-new-answer-option"]`).type(lastElement)
    cy.get(`[data-cy="save-new-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="input-new-answer-option"]`).clear().type(existingElement) // duplicate answer options not allowed
    cy.get(`[data-cy="save-new-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="input-new-answer-option"]`).type(lastElement)
    cy.get(`[data-cy="save-new-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="input-new-answer-option"]`).clear() // empty answers not allowed
    cy.get(`[data-cy="save-new-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="input-new-answer-option"]`).type(lastElement)
    cy.get(`[data-cy="save-new-answer-option"]`).click()
    cy.get(`[data-cy="answer-option-${lastElement}"]`).contains(lastElement)
  })

  it('Verify that the changes to the private answer collection persist', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.nameNew}"]`).click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.private.nameNew
    )
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.private.descriptionNew)
    cy.wrap(this.data.private.itemsNew).each((value: string) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })
  })

  it('Verify that all three answer collections can be used in selection questions by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="select-answer-collection-${this.data.restricted.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="select-answer-collection-${this.data.private.nameNew}"]`
    ).should('exist')
  })

  it('Cleanup: Delete all created answer collections (full deletion, since no other users have access)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.nameNew}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )

    cy.wrap([
      this.data.private.nameNew,
      this.data.restricted.name,
      this.data.public.name,
    ]).each((name: string) => {
      deleteAnswerCollection({ name })
    })
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', function () {
    validateDatabaseContent()
  })
  // #endregion

  // ! Sharing functionalities (private collection)
  // #region
  it('Create a private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.private.name,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: this.data.private.description,
      entries: this.data.private.items,
    })
  })

  it('Verify that the private answer collection is not visible in the catalog for the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="import-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the private answer collection is not visible in the catalog for other users', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  // TODO (later): share private answer collection directly with another user

  it('Verify that the private answer collection can be used in a selection quesetion by the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      title: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.private.name,
      correctAnswers: this.data.private.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
    })

    // check that question exists
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
  })

  it("Verify that the private answer collection cannot be integrated into a question by user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(
      'To create selection questions, you need access to at least one answer collection! You can either create one yourself under the "Resources" tab or import an existing collection from other users there.'
    )
  })

  it("Verify that the private answer collection cannot be removed by user 'pro1' as it is used in a question", function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
  })

  it('Delete the selection question that depends on the private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
    cy.deleteElement({ elementName: this.data.question.title })
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the private answer collection can be deleted', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    deleteAnswerCollection({ name: this.data.private.name })
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', function () {
    validateDatabaseContent()
  })

  // #endregion

  // ! Sharing functionalities (restricted collection)
  // #region
  it('Create a restricted answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.restricted.name,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: this.data.restricted.description,
      entries: this.data.restricted.items,
    })
  })

  it('Verify that public answer collection is visible to owner in catalog, but cannot be requested / imported', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Test filters and search on the catalog page', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()

    // test search
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get('[data-cy="search-catalog-collection"]')
      .click()
      .type(this.data.private.name)
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="search-catalog-collection"]')
      .clear()
      .type(this.data.restricted.name)
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )

    // test access type filters
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get('[data-cy="catalog-access-type-filter"]').contains(
      messages.manage.catalog.all
    )
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-public"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-restricted"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get('[data-cy="catalog-access-type-filter"]').click()
    cy.get('[data-cy="catalog-access-all"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
  })

  it('Request access to restricted answer collection (for user pro1)', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="cancel-answer-collection-request"]').click()
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Request access to restricted answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to collection owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('exist')
  })

  it('Verify that answer collection cannot be integrated into question by user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(
      'To create selection questions, you need access to at least one answer collection! You can either create one yourself under the "Resources" tab or import an existing collection from other users there.'
    )
  })

  it('Grant access to restricted answer collection (for user pro1)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="access-level-select"]').contains(
      messages.manage.catalog.accessLevelREAD
    )
    cy.get('[data-cy="access-level-select"]').click()
    cy.get('[data-cy="access-level-read"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to restricted answer collection (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro2"]`
    ).click()
  })

  it('Verify that restricted answer collection is visible in resources for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )

    // check that the collection can be used in selection questions
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.restricted.name}"]`
    ).click()
  })

  it('Verify that restricted answer collection is not visible in resources for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.findByText(messages.manage.resources.noAnswerCollections)
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )

    // check that the collection cannot be used in selection questions
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(
      'To create selection questions, you need access to at least one answer collection! You can either create one yourself under the "Resources" tab or import an existing collection from other users there.'
    )
  })

  it('Verify that restricted answer collection can be used in selection question by user pro1 and create question', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      title: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.restricted.name,
      correctAnswers: this.data.restricted.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
    })
  })

  it('Verify that collection cannot be removed by user pro1 as it is used in a question', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').should('be.disabled')
  })

  it('Verify that answer option used as a sample solution cannot be removed (by owner)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()

    // check that all answer options can be edited, only non-solution items can be removed
    cy.wrap(this.data.restricted.items).each((value: string, ix: number) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).should(
        'not.be.disabled'
      )

      if (this.data.question.solutions.includes(ix)) {
        cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
          'be.disabled'
        )
      } else {
        cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
          'not.be.disabled'
        )
      }
    })
  })

  it('Delete the selection question (user pro1)', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
    cy.deleteElement({ elementName: this.data.question.title })
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'not.exist'
    )
  })

  it('Verify that restricted answer collection can be removed by user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="close-remove-answer-collection"]').click()
  })

  it('Verify that all answer options of the restricted answer collection can be edited and deleted again by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()

    // check that all answer options can be edited, only non-solution items can be removed
    cy.wrap(this.data.restricted.items).each((value: string, ix: number) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
    })
  })

  it('Remove created restricted answer collection (through owner interface - soft deletion)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    deleteAnswerCollection({ name: this.data.restricted.name })
  })

  it('Verify that the restricted answer collection is still visible to user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
  })

  it('Remove the restricted answer collection from user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    removeAnswerCollection({ name: this.data.restricted.name })
  })

  it('Cleanup: Verify that all created answer collections have been deleted properly', function () {
    validateDatabaseContent()
  })
  // #endregion

  // ! Sharing functionalities (public collection)
  // #region
  it('Create a public answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.public.name,
      accessCy: 'public',
      access: messages.manage.resources.accessPUBLIC,
      description: this.data.public.description,
      entries: this.data.public.items,
    })
  })

  it('Verify that public answer collection is visible to owner in catalog, but cannot be requested / imported', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).should(
      'not.exist'
    )
  })

  it("Request access to the public answer collection (for user 'pro1')", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).click()
    cy.findByText(messages.manage.catalog.requestPublicResource)
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it("Request access to the public answer collection (for user 'pro2')", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to collection owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.public.name}-pro1"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.public.name}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.public.name}-pro1"]`
    ).should('exist')
    cy.get(`[data-cy="sharing-request-${this.data.public.name}-pro2"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.public.name}-pro2"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.public.name}-pro2"]`
    ).should('exist')
  })

  it('Grant access to public answer collection (for user pro1)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.public.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="access-level-select"]').contains(
      messages.manage.catalog.accessLevelREAD
    )
    cy.get('[data-cy="access-level-select"]').click()
    cy.get('[data-cy="access-level-read"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to public answer collection (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.public.name}-pro2"]`
    ).click()
  })

  it("Verify that the public answer collection is visible in resources for user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )

    // check that the collection can be used in selection questions
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.public.name}"]`
    ).click()
  })

  it("Verify that the public answer collection is not visible in resources for user 'pro2'", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.findByText(messages.manage.resources.noAnswerCollections)
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )

    // check that the collection cannot be used in selection questions
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(
      'To create selection questions, you need access to at least one answer collection! You can either create one yourself under the "Resources" tab or import an existing collection from other users there.'
    )
  })

  it('Import (and copy) the public answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="close-answer-collection-import-modal"]').click()

    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="cancel-answer-collection-import"]').click()
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-import"]').click()

    // check that the collection is visible in resources
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )
  })

  it('Verify that imported answer collection is visible to user pro2 (copied and with edit permissions)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessPRIVATE)
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()

    // check that all answer options can be edited
    cy.wrap(this.data.public.items).each((value: string) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
    })
  })

  it('Remove the public answer collection from user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )
    removeAnswerCollection({ name: this.data.public.name })
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )
  })

  it('Create a selection question with sample solution and imported answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      title: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.public.name,
      correctAnswers: this.data.public.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
    })

    // check that question exists
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
  })

  it("Verify that imported answer collection cannot be deleted by user 'pro2' as it is used in a question", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
  })

  it('Verify that original answer collection can be completely edited by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()

    // check that all answer options can be edited
    cy.wrap(this.data.public.items).each((value: string) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
    })
  })

  it('Delete the created public answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    deleteAnswerCollection({ name: this.data.public.name })
  })

  it('Verify that imported answer collection is still visible to user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )
  })

  it('Delete the selection question for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
    cy.deleteElement({ elementName: this.data.question.title })
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'not.exist'
    )
  })

  it('Remove the imported answer collection from user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    deleteAnswerCollection({ name: this.data.public.name })
  })

  it('Cleanup: Verify that all created answer collections have been deleted properly', function () {
    validateDatabaseContent()
  })

  // #endregion

  // ! Access rule modifications (automatic declining of requests / persistence of access / ...)
  // #region
  it('Create a private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.createAnswerCollection({
      name: this.data.private.name,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: this.data.private.description,
      entries: this.data.private.items,
    })
  })

  it('Verify that the private answer collection is not visible in the catalog for the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Change the access rights to restricted access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPRIVATE
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="save-changes-answer-collection"]').click()
  })

  it('Verify that the restricted answer collection is now also visible to other users and request access for pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.private.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Change the access rights to public access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-public"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="save-changes-answer-collection"]').click()
  })

  it('Verify that the pending access request is still visible to the user', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that the pending sharing request is still visible to the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.private.name}-pro1"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.private.name}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.private.name}-pro1"]`
    ).should('exist')
  })

  it('Verify that the public answer collection is still visible in the catalog for the owner and can be imported', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-object-${this.data.private.name}"]`).should(
      'exist'
    )
  })

  it('Request access to the public answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.private.name}"]`).click()
    cy.get('[data-cy="confirm-answer-collection-request"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Change the access rights to restricted access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="save-changes-answer-collection"]').click()
  })

  it('Verify that the import functionality is not available anymore', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Approve access request for user pro1', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.private.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="access-level-select"]').contains(
      messages.manage.catalog.accessLevelREAD
    )
    cy.get('[data-cy="access-level-select"]').click()
    cy.get('[data-cy="access-level-read"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Change the access rights to private access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-private"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPRIVATE
    )
    cy.get('[data-cy="save-changes-answer-collection"]').click()
  })

  it('Verify that access request by user pro2 has been declined automatically', function () {
    cy.loginLecturer()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.private.name}-pro2"]`).should(
      'not.exist'
    )
  })

  it('Verify that answer collection is also not shown as pending request for user pro2 anymore', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that user pro1 still has access to the private collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).click()

    // validate content of viewing modal
    cy.wrap(this.data.private.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Cleanup: Remove the private answer collection from user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    removeAnswerCollection({ name: this.data.private.name })
  })

  it('Cleanup: Delete the private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    deleteAnswerCollection({ name: this.data.private.name })
  })

  it('Cleanup: Verify that all created answer collections have been deleted properly', function () {
    validateDatabaseContent()
  })
  // #endregion
})
