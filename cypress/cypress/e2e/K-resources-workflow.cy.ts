import messages from '../../../packages/i18n/messages/en'

describe('Create, edit and share answer collections', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('K-resources.json').then((data) => {
      this.data = data
    })
  })

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
    this.data.public.items.slice(2).forEach((value, ix) => {
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
    this.data.private.items.forEach((value) => {
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
    this.data.private.items.forEach((value, ix) => {
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
    this.data.private.itemsNew.forEach((value, ix) => {
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

  it('Verify that the public answer collection can be switched to private if no other users have access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').should(
      'not.have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-private"]').should(
      'not.have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-public"]').click()
  })

  it('Verify that the restricted answer collection can be switched to private if no other users have access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-public"]').should(
      'not.have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-private"]').should(
      'not.have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-restricted"]').click()
  })
  // #endregion

  // ! Sharing of answer collections
  // #region
  it('Request access to the restricted answer collection for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // test filters and then request access
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('exist')

    // test search
    cy.get('[data-cy="search-answer-collection"]')
      .click()
      .type(this.data.public.name)
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('not.exist')
    cy.get('[data-cy="search-answer-collection"]')
      .click()
      .clear()
      .type(this.data.restricted.name)
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('exist')
    cy.get('[data-cy="search-answer-collection"]').click().clear()

    // test type filter
    cy.get('[data-cy="answer-collection-access-filter"]').contains(
      messages.manage.resources.all
    )
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-public"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('not.exist')
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('exist')
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-all"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('exist')

    // request access and make sure that it shows up as requested
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="import-modal-cancel"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(messages.manage.resources.requestedAccess)
  })

  function requestAccessPro2(data) {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(`[data-cy="import-list-collection-${data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="import-list-collection-${data.restricted.name}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="import-list-collection-${data.restricted.name}"]`).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(
      data.restricted.name
    )
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      data.restricted.description
    )
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${data.restricted.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(`[data-cy="answer-collection-${data.restricted.name}"]`).contains(
      messages.manage.resources.requestedAccess
    )

    // content should not be accessible
    cy.get(`[data-cy="answer-collection-${data.restricted.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').should('not.exist')
  }

  it('Request access to the restricted answer collection for user pro2', function () {
    requestAccessPro2(this.data)
  })

  it('Cancel request to the restricted answer collection for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-cancel-sharing-request"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Request access to the restricted answer collection again (pro2)', function () {
    requestAccessPro2(this.data)
  })

  it('Approve (pro1) and deny (pro2) the access requests to the restricted answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')

    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()

    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.reload()
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
  })

  it('Verify that user pro1 has access to the restricted answer collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(Cypress.env('LECTURER_SHORTNAME'))
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()

    // check that the entire content is visible
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    this.data.restricted.items
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
  })

  it('Verify that only the shared and restricted answer collection is available during question creation for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.public.name}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="select-answer-collection-${this.data.restricted.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="select-answer-collection-${this.data.private.nameNew}"]`
    ).should('not.exist')
  })

  it('Verify that user pro2 does not have access to the restricted answer collection', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that no answer collection is available for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Import the public answer collection for user pro1 and verify access to it', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // import answer collection
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(
      this.data.public.name
    )
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      this.data.public.description
    )
    cy.get('[data-cy="public-collection-show-answers"]').click()
    this.data.public.itemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="public-collection-answer-option-${ix}"]`).contains(
          value
        )
      })
    cy.get('[data-cy="import-modal-cancel"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessPUBLIC)
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).contains(
      messages.manage.resources.viewCollection
    )
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('not.exist')

    // check that the imported collection is visible
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.public.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.public.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    this.data.public.itemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()
  })

  it('Verify that imported public answer collection is also available for during question creation user pro1', function () {
    cy.loginIndividualCatalyst()
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
    ).should('not.exist')
  })

  it('Login again as user pro1 and verify that the answer collections are still visible', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // verify that restricted collection is accessbile
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(Cypress.env('LECTURER_SHORTNAME'))
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    this.data.restricted.items
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()

    // verify that public collection is still visible
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.public.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.public.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    this.data.public.itemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()
  })
  // #endregion

  // ! Answer collection deletion workflows
  // #region
  it('Request access to the restricted answer collection for user pro2', function () {
    requestAccessPro2(this.data)
  })

  it('Verify that shared restricted and public collections can be soft deleted, soft delete restricted collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    // soft delete restricted collection
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
  })

  it('Verify that the restricted and shared collection can still be accessed', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(messages.shared.generic.unknown)
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()

    // check that the entire content is visible
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    this.data.restricted.items
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
  })

  it('Verify that requested collections are automatically declined on soft deletion', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the restricted collection cannot be requested anymore', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).should('not.exist')
  })

  it('Add a question to the shared public answer collection', function () {
    cy.loginLecturer()
    cy.createQuestionSE({
      title: this.data.question.title,
      content:
        'This question fulfills its purpose by blocking the deletion of the public answer collection',
      numberOfInputs: 2,
      collectionName: this.data.public.name,
    })
  })

  it('Verify that the shared answer collection cannot be deleted due to the linked question', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('After deletion of the question, the shared answer collection can be removed and is deleted', function () {
    cy.loginLecturer()
    cy.deleteElement({ elementName: this.data.question.title })

    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
  })

  it('Cleanup: Remove all remaining answer collections from user pro1 (restricted and public)', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Verify that no answer collection is available for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Cleanup: Verify that no answer collection is available for user pro3', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Cleanup: Delete all remaining answer collections (public and private)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${this.data.private.nameNew}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.nameNew}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', function () {
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

  // ! Access rule modifications and automatic accepts
  // #region
  it('Create a new restricted and public collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: this.data.public.name,
      accessCy: 'public',
      access: messages.manage.resources.accessPUBLIC,
      description: this.data.public.description,
      entries: this.data.public.items,
    })

    cy.createAnswerCollection({
      name: this.data.restricted.name,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: this.data.restricted.description,
      entries: this.data.restricted.items,
    })
  })

  it('Request access to restricted collection for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(messages.manage.resources.requestedAccess)
  })

  it('Give access to restricted collection to user pro1', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
  })

  it('Import public collection and verify access to restricted collection for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // verify that restricted collection is accessible
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(Cypress.env('LECTURER_SHORTNAME'))
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    this.data.restricted.items
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()

    //  import public collection and verify access
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessPUBLIC)
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).contains(
      messages.manage.resources.viewCollection
    )
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.public.name
    )
  })

  it('Request access to restricted collection for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(messages.manage.resources.requestedAccess)
  })

  it("Verify that user pro2 doesn't have access to restricted collection", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').should('not.exist')
  })

  it('Verify that the public answer collection cannot be switched back to private or restricted anymore once other users use it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-private"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-public"]').click()
  })

  it('Verify that the restricted answer collection cannot be switched to private once other users use it and switch it to public', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-private"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-public"]').click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    cy.reload()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="answer-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    cy.get('[data-cy="answer-collection-access"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-private"]').should(
      'have.css',
      'pointer-events',
      'none'
    )
    cy.get('[data-cy="answer-collection-access-public"]').click()
  })

  it('Verify that user pro2 now automatically also has access to the previously restricted collection', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-${this.data.restricted.name}"]`
    ).contains(Cypress.env('LECTURER_SHORTNAME'))
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(
      this.data.restricted.name
    )
    cy.get('[data-cy="viewing-collection-description"]').contains(
      this.data.restricted.description
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    this.data.restricted.items
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
  })

  it('Cleanup: Remove the previously restricted answer collection from user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Remove the public and previously restricted answer collection from user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete the public and previously restricted answer collection from lecturer', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Create a new restricted collection', function () {
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

  it('Request access to restricted collection for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
  })

  it('Request access to restricted collection for user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(
      `[data-cy="import-list-collection-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
  })

  it('Approve both access requests to the restricted collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()
  })

  it('Remove the restricted answer collection from user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Remove the restricted answer collection from user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that restricted collection is still available to owner and delete it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Verify that all answer collections have been deleted properly', function () {
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
