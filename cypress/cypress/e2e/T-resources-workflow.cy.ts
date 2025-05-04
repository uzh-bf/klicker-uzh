import { SharingObjectType } from '@klicker-uzh/types'
import messages from '../../../packages/i18n/messages/en'

describe('Create, edit and share answer collections', function () {
  before(() => {
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load fixture for this test case', function () {
    cy.fixture('T-resources.json').then((data) => {
      this.data = data
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Helper functions
  // #region
  function removeAnswerCollection({ name }: { name: string }) {
    cy.get(`[data-cy="answer-collection-actions-${name}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-object"]').click()
  }

  function grantCollectionAccess({
    collectionName,
    permissionLevel,
    permissionLevelCy,
    username,
  }: {
    collectionName: string
    permissionLevel: string
    permissionLevelCy: string
    username: string
  }) {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-actions-${collectionName}"]`).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // directly add permission for user pro2
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(username)
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get(`[data-cy="permission-level-${permissionLevelCy}"]`).click()
    cy.get('[data-cy="new-permission-access-level"]').contains(permissionLevel)
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${username}"]`)
      .should('exist')
      .contains(permissionLevel)
  }
  // #endregion

  // ! 1. Creation and editing of answer collections
  // #region
  it('Create an answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

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
  })

  it('Edit the answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.public.name
    )
    cy.get('[data-cy="answer-collection-name"]')
      .clear()
      .type(this.data.public.nameNew)
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.public.nameNew
    )

    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.public.description)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .clear()
      .type(this.data.public.descriptionNew)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.public.descriptionNew)
    cy.wait(100) // wait for states to propagate
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    // check that current values are correct
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.public.itemsAfterDeletion).each((value: string) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })

    // verify validation for editing answer options
    cy.get(
      `[data-cy="edit-answer-option-${this.data.public.itemsAfterDeletion[0]}"]`
    ).click()
    cy.get(`[data-cy="edit-answer-option-input"]`).should(
      'have.value',
      this.data.public.itemsAfterDeletion[0]
    )

    cy.get(`[data-cy="save-edit-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.public.itemsAfterDeletion[1]) // duplicate answer options not allowed
    cy.get(`[data-cy="save-edit-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.public.itemsAfterDeletion[0])
    cy.get(`[data-cy="save-edit-answer-option"]`).should('not.be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`).clear() // empty options are not allowed
    cy.get(`[data-cy="save-edit-answer-option"]`).should('be.disabled')
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .clear()
      .type(this.data.public.itemsAfterDeletion[0])
    cy.get(`[data-cy="save-edit-answer-option"]`).click()

    // change all answer option values
    cy.wrap(this.data.public.itemsAfterDeletion).each((value: string, ix) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).click()
      cy.get(`[data-cy="edit-answer-option-input"]`).should('have.value', value)
      cy.get(`[data-cy="edit-answer-option-input"]`)
        .clear()
        .type(this.data.public.itemsNew[ix])
      cy.get(`[data-cy="save-edit-answer-option"]`).click()
      cy.get(
        `[data-cy="answer-option-${this.data.public.itemsNew[ix]}"]`
      ).contains(this.data.public.itemsNew[ix])
    })

    // verify validation for newly added answer options and add new answer option
    const existingElement = this.data.public.itemsNew[0]
    const lastElement =
      this.data.public.itemsNew[this.data.public.itemsNew.length - 1]
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.nameNew}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      this.data.public.nameNew
    )
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(this.data.public.descriptionNew)
    cy.wait(100) // wait for states to propagate
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.public.itemsNew).each((value: string) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })
  })

  it('Verify that all answer collections can be used in selection questions by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.public.nameNew}"]`
    ).should('exist')
  })

  it('Cleanup: Delete all created answer collections (full deletion, since no other users have access)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.nameNew}"]`).should(
      'exist'
    )

    cy.deleteAnswerCollection({ collectionName: this.data.public.nameNew })
  })
  // #endregion

  // ! 2. Sharing functionalities (private collection)
  // #region
  it('Create a private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.private.name,
      description: this.data.private.description,
      entries: this.data.private.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Verify that the private answer collection can be used in a selection question by the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.private.name,
      correctAnswers: this.data.private.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_ID'),
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
  })

  it('Verify that the private answer collection cannot be deleted as it is used in a question', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.private.name}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.private.name })
  })
  // #endregion

  // ! 3. Sharing functionalities (restricted collection)
  // #region
  it('Create an answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.restricted.name,
      description: this.data.restricted.description,
      entries: this.data.restricted.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Add the answer collection as a restricted collection to the catalog', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add collection to catalog as restricted object
    cy.addObjectToCatalog({
      objectName: this.data.restricted.name,
      objectType: SharingObjectType.ANSWER_COLLECTION,
      permissionLevel: 'restricted',
    })

    // check that import and request functionalities are not available for owner (but deletion is)
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="import-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="remove-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
  })

  it('Test filters and search on the catalog page', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="cancel-request-access"]').click()
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Request access to restricted answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to collection owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
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

  it('Temporarily award ADMIN permissions to user pro3 and verify that the access requests are visible as well', function () {
    // grant ADMIN permissions to user pro3 through direct sharing
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST2_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
    cy.logoutUser()

    // verify that access requests are visible to user pro3
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
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
    cy.logoutUser()

    // revoke direct ADMIN permissions again
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="cancel-revocation"]').click()
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
    cy.logoutUser()

    // verify that the access requests are not visible anymore to user pro3
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro1"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro2"]`
    ).should('not.exist')
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
  })

  it('Cancel the request through user pro1 and request the answer collection again', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )

    // cancel the request
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="cancel-request-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-request-cancellation"]').click()

    // request the answer collection again (should be possible)
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending again
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Grant access to restricted answer collection (for user pro1)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.restricted.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to restricted answer collection (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.restricted.name}-pro2"]`
    ).click()
  })

  it("Verify that the active permission for user 'pro1' is shown correctly", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it('Verify that restricted answer collection is visible in resources for user pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
  })

  it('Verify that restricted answer collection can be used in selection question by user pro1 and create question', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.restricted.name,
      correctAnswers: this.data.restricted.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_IND_ID'),
    })
  })

  it('Verify that collection cannot be removed by user pro1 as it is used in a question', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it('Verify that answer option used as a sample solution cannot be removed (by owner)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // check that all answer options can be edited, only non-solution items can be removed
    cy.get('[data-cy="open-answer-collection-options"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="close-remove-object"]').click()
  })

  it('Verify that all answer options of the restricted answer collection can be edited and deleted again by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // check that all answer options can be edited, only non-solution items can be removed
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.restricted.items).each((value: string, ix: number) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="delete-answer-option-${value}"]`).should(
        'not.be.disabled'
      )
    })
  })

  it('Change the access level of the answer collection in the catalog to public', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(`[data-cy="${this.data.restricted.name}-object-access"]`).contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get(`[data-cy="${this.data.restricted.name}-object-access"]`).realClick()
    cy.get('[data-cy="object-access-restricted"]').should('exist')
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="confirm-access-change"]').click()
    cy.get(`[data-cy="${this.data.restricted.name}-object-access"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )
  })

  it('Verify that answer collections can now be imported or requested', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="import-object-${this.data.restricted.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="request-access-${this.data.restricted.name}"]`).should(
      'exist'
    )

    // no owner / admin actions are available
    cy.get(`[data-cy="remove-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="${this.data.restricted.name}-object-access"]`).should(
      'not.exist'
    )
  })

  it('Remove the answer collection from the catalog (by owner)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="actions-dropdown-${this.data.restricted.name}"]`
    ).realClick()
    cy.get(`[data-cy="remove-object-${this.data.restricted.name}"]`).click()
    cy.get('[data-cy="confirm-removal"]').click()
  })

  it('Verify that the answer collection is no longer visible in the catalog', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Re-add the answer collection with restricted access to the answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.addObjectToCatalog({
      objectName: this.data.restricted.name,
      objectType: SharingObjectType.ANSWER_COLLECTION,
      permissionLevel: 'restricted',
    })
  })

  it("Grant admin access to user 'pro2' for the restricted answer collection", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.restricted.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').clear()
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that user pro2 should now be able to add this collection to the catalog', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${SharingObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).should('exist')
  })

  it("Create a question with the restricted answer collection for user 'pro2'", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.restricted.name,
      correctAnswers: this.data.restricted.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_INST_ID'),
    })
  })

  it('Delete created restricted answer collection (through owner interface - soft deletion since used by pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.restricted.name })
  })

  it('Verify that the soft-deleted answer collection is no longer visible in the catalog', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(`[data-cy="catalog-object-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the unused access to the collection for user pro1 has been revoked', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the used access to the collection for user pro2 is still intact, delete the question and remove the collection', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'exist'
    )

    // object can no longer be added to the catalog (since it was deleted by the owner)
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${SharingObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.findByText(messages.manage.catalog.noObjectsAvailable)
    cy.get('[data-cy="close-add-object-modal"]').click()

    // delete the dependent question
    cy.get('[data-cy="library"]').click()
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
    cy.deleteElement({ elementName: this.data.question.title })
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'not.exist'
    )

    // since the user only retained a derived permission on the collection, the removal of
    // the parent element should have resulted in the automatic removal of the access
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.restricted.name}"]`).should(
      'not.exist'
    )
  })
  // #endregion

  // ! 4. Sharing functionalities (public collection)
  // #region
  it('Create an answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.public.name,
      description: this.data.public.description,
      entries: this.data.public.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Add the answer collection with public access to the catalog and verify visibility', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.addObjectToCatalog({
      objectName: this.data.public.name,
      objectType: SharingObjectType.ANSWER_COLLECTION,
      permissionLevel: 'public',
    })

    // answer collection should be visible to owner, but cannot be requested / imported
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="remove-object-${this.data.public.name}"]`).should('exist')
  })

  it("Request access to the public answer collection (for user 'pro1')", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).click()
    cy.findByText(messages.manage.catalog.requestPublicResource)
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it("Request access to the public answer collection (for user 'pro2')", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.public.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that access requests are correctly shown to collection owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.public.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Decline access request to public answer collection (for user pro2)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.public.name}-pro2"]`
    ).click()
  })

  it("Verify that the active permission for user 'pro1' is shown correctly", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it("Verify that the public answer collection is visible in resources for user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
  })

  it('Import (and copy) the public answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.public.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="close-object-import-modal"]').click()

    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="cancel-object-import"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.public.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.public.name}"]`).click()
    cy.get('[data-cy="confirm-object-import"]').click()

    // check that the collection is visible in resources
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.public.name}"]`).should(
      'exist'
    )
  })

  it('Verify that imported answer collection is visible to user pro2 (copied and with edit permissions)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // check that all answer options can be edited
    cy.get('[data-cy="open-answer-collection-options"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.public.name,
      correctAnswers: this.data.public.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_INST_ID'),
    })

    // check that question exists
    cy.get(`[data-cy="element-item-${this.data.question.title}"]`).should(
      'exist'
    )
  })

  it("Verify that imported answer collection cannot be deleted by user 'pro2' as it is used in a question", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it('Verify that original answer collection can be completely edited by owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.public.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // check that all answer options can be edited
    cy.get('[data-cy="open-answer-collection-options"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.public.name })
  })

  it('Verify that imported answer collection is still visible to user pro2 (due to derived permission)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
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
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.public.name })
  })
  // #endregion

  // ! 5. Sharing functionalities (user groups)
  // #region
  it('Create user groups with all users and prepare a new answer collection for user group sharing', function () {
    // create answer collection with restricted access
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.shared.name,
      description: this.data.shared.description,
      entries: this.data.shared.items,
      userId: Cypress.env('LECTURER_ID'),
    })

    // create user group with users 1 (OWNER) and pro1 (MEMBER)
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group1)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME')) // pro1 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group1}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group1}"]`).should('exist')
    cy.get(`[data-cy="view-edit-group-${this.data.group1}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()

    // create user group with users 1 (OWNER) and pro2 (ADMIN)
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group2)
    cy.get('[data-cy="cancel-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group2)

    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL')) // pro2 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group2}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group2}"]`).should('exist')
    cy.get(`[data-cy="view-edit-group-${this.data.group2}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()
    cy.logoutUser()

    // create user group with users 1 (MEMBER) and pro3 (OWNER)
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group3)
    cy.get('[data-cy="cancel-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.group3)

    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_SHORTNAME')) // lecturer is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.group3}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.group3}"]`).should('exist')
    cy.get(`[data-cy="delete-group-${this.data.group3}"]`).should('exist')

    cy.get(`[data-cy="view-edit-group-${this.data.group3}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()
    cy.logoutUser()
  })

  it('Grant direct READ, WRITE and ADMIN permissions to the answer collection for the user groups', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.shared.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // grant direct READ permissions to group 1
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group1}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group1)
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group1}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    // grant direct WRITE permissions to group 2
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group2}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group2)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group2}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // grant direct ADMIN permissions to group 3
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.get('[data-cy="new-permission-user-group"]').realClick()
    cy.get(`[data-cy="user-group-${this.data.group3}"]`).click()
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group3)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${this.data.group3}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that the users in group 1 have been granted READ permissions on the answer collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.shared.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.shared.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.shared.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Verify that the users in group 2 have been granted WRITE permissions on the answer collection', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.shared.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.shared.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
  })

  it('Verify that the users in group 3 have been granted ADMIN permissions on the answer collection', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.shared.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.shared.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
  })
  // #endregion

  // ! 5. Modification of availability in catalog (automatic declining of requests / persistence of access / ...)
  // #region
  it('Create a private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.private.name,
      description: this.data.private.description,
      entries: this.data.private.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Verify that the private answer collection is not visible in the catalog for the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Add the private collection with restricted object access to the catalog', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.addObjectToCatalog({
      objectName: this.data.private.name,
      objectType: SharingObjectType.ANSWER_COLLECTION,
      permissionLevel: 'restricted',
    })
  })

  it('Verify that the restricted answer collection is now also visible to other users and request access for pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.private.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.private.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Change the access rights to public access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).realClick()
    cy.get('[data-cy="object-access-restricted"]').should('exist')
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="confirm-access-change"]').click()
    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )
  })

  it('Verify that the pending access request is still visible to the user', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Verify that the pending sharing request is still visible to the owner', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
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

  it('Verify that the public answer collection is still visible in the catalog for a different user and can be imported', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.private.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.private.name}"]`).should(
      'exist'
    )
  })

  it('Request access to the public answer collection (for user pro2)', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.private.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.private.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()

    // check that access request is pending
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).contains(
      messages.manage.catalog.accessRequested
    )
  })

  it('Change the access rights to restricted access', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="confirm-access-change"]').click()
    cy.get(`[data-cy="${this.data.private.name}-object-access"]`).contains(
      messages.manage.catalog.accessRESTRICTED
    )
  })

  it('Verify that the import functionality is not available anymore', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.private.name}"]`).realClick()
    cy.get(`[data-cy="import-object-${this.data.private.name}"]`).should(
      'not.exist'
    )
  })

  it('Approve access request for user pro1', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.private.name}-pro1"]`
    ).click()

    // approval modal
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-approval"]').click()
  })

  it('Remove the answer collection entirely from the catalog', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.private.name}"]`).realClick()
    cy.get(`[data-cy="remove-object-${this.data.private.name}"]`).click()
    cy.get('[data-cy="confirm-removal"]').click()
  })

  it('Verify that access request by user pro2 has been not been declined automatically and decline it', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.private.name}-pro2"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.private.name}-pro2"]`
    ).click()
  })

  it('Verify that user pro1 still has access to the private collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.private.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.private.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()

    // validate content of viewing modal
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.private.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Cleanup: Delete the private answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    // read permission for user pro1 is automatically revoked, since the collection is not used
    cy.deleteAnswerCollection({ collectionName: this.data.private.name })
  })
  // #endregion

  // ! 6. Direct Sharing of answer collections
  // #region
  it('Create a restricted answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.direct.name,
      description: this.data.direct.description,
      entries: this.data.direct.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it("Give direct access to user 'pro1'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').should('exist')

    grantCollectionAccess({
      collectionName: this.data.direct.name,
      username: Cypress.env('LECTURER_IND_SHORTNAME'),
      permissionLevel: messages.manage.sharing.permissionsREAD,
      permissionLevelCy: 'READ',
    })
  })

  it('Add the answer collection with restricted object access to the catalog', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.addObjectToCatalog({
      objectName: this.data.direct.name,
      objectType: SharingObjectType.ANSWER_COLLECTION,
      permissionLevel: 'restricted',
    })
  })

  it("Verify that the restricted answer collection is visible in resources for user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'exist'
    )

    // check that the answer options are visible
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.direct.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.direct.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Request access to the restricted answer collection (for user 'pro2')", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.direct.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="actions-dropdown-${this.data.direct.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.direct.name}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()
  })

  it("Verify that the sharing request by user 'pro2' is visible in the catalog and give direct access to the answer collection", function () {
    // verify visibility of sharing request
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.direct.name}-pro2"]`).should(
      'exist'
    )

    // give direct access to the answer collection
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.direct.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it("Verify that the access request by user 'pro2' has been resolved automatically", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="sharing-request-${this.data.direct.name}-pro2"]`).should(
      'not.exist'
    )
  })

  it("Verify that the restricted answer collection is visible in resources for user 'pro2'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.direct.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.direct.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Verify that shared answer collection can be used in questions by user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.direct.name}"]`
    ).click()
  })

  it("Cleanup: Remove the shared answer collection from user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'exist'
    )
    removeAnswerCollection({ name: this.data.direct.name })
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'not.exist'
    )
  })

  it("Cleanup: Remove the shared answer collection from user 'pro2'", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'exist'
    )
    removeAnswerCollection({ name: this.data.direct.name })
    cy.get(`[data-cy="answer-collection-${this.data.direct.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete the restricted answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.direct.name })
  })
  // #endregion

  // ! 7. Access levels and associated permissions & functionalities
  // #region
  function testAnswerCollectionEditPermissions(data) {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-actions-${data.access.name}"]`).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // change the name of the answer collection
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      data.access.name
    )
    cy.get('[data-cy="answer-collection-name"]')
      .click()
      .clear()
      .type(data.access.replacedName)
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    // modify the first answer option by appending a number to it
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.get(`[data-cy="edit-answer-option-${data.access.items[0]}"]`).click()
    cy.get(`[data-cy="edit-answer-option-input"]`).should(
      'have.value',
      data.access.items[0]
    )
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .click()
      .clear()
      .type(data.access.replacedEntry)
    cy.get(`[data-cy="save-edit-answer-option"]`).click()

    // add new answer option
    cy.get('[data-cy="add-answer-option"]').click()
    cy.get(`[data-cy="input-new-answer-option"]`).type(data.access.newEntry)
    cy.get(`[data-cy="save-new-answer-option"]`).click()

    // add second new answer option and delete it again
    cy.get('[data-cy="add-answer-option"]').click()
    cy.get('[data-cy="input-new-answer-option"]')
      .click()
      .type(data.access.newEntry2)
    cy.get('[data-cy="save-new-answer-option"]').click()
    cy.get(`[data-cy="delete-answer-option-${data.access.newEntry2}"]`).click()
  }

  function validateAndUndoWritePermissionChanges(data) {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${data.access.replacedName}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    // verify that the name of the collection has been modified and undo it
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      data.access.replacedName
    )
    cy.get('[data-cy="answer-collection-name"]')
      .click()
      .clear()
      .type(data.access.name)
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    // verify that the first answer option has been modified and undo it
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.get(
      `[data-cy="edit-answer-option-${data.access.replacedEntry}"]`
    ).click()
    cy.get(`[data-cy="edit-answer-option-input"]`).should(
      'have.value',
      data.access.replacedEntry
    )
    cy.get(`[data-cy="edit-answer-option-input"]`)
      .click()
      .clear()
      .type(data.access.items[0])
    cy.get(`[data-cy="save-edit-answer-option"]`).click()

    // verify that the new answer option has been added and undo it
    cy.get(`[data-cy="edit-answer-option-${data.access.newEntry}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-answer-option-${data.access.newEntry}"]`).click()

    // verify that the second new answer option has been removed
    cy.get(`[data-cy="edit-answer-option-${data.access.newEntry2}"]`).should(
      'not.exist'
    )
  }

  it('Create a new private answer collection that can be shared between users with different access levels', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.access.name,
      description: this.data.access.description,
      entries: this.data.access.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it("Grant READ permissions to user 'pro1'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // directly add permission for user pro1
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_IND_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it("Grant WRITE permissions to user 'pro2'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // directly add permission for user pro2
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)
  })

  it("Grant ADMIN permissions to user 'pro3'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // directly add permission for user pro3
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_INST2_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro1' can view the answer collection", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )

    // validate content of viewing modal
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.access.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Verify that user 'pro1' can remove the answer collection (but do not trigger removal)", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should('exist')
    cy.get('[data-cy="delete-answer-collection"]').should('not.exist')
  })

  it("Verify that user 'pro1' can use the created answer collection in a question", function () {
    cy.loginIndividualCatalyst()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.access.name,
      correctAnswers: this.data.access.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_IND_ID'),
    })
  })

  it("Verify that user 'pro1' can no longer remove the used answer collection", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it("Use the write permissions of user 'pro2' to make changes to the answer collection", function () {
    cy.loginInstitutionalCatalyst()
    testAnswerCollectionEditPermissions(this.data)
  })

  it('Verify as an owner that the changes persist and undo them', function () {
    cy.loginLecturer()
    validateAndUndoWritePermissionChanges(this.data)
  })

  it("Verify that user 'pro2' can remove the answer collection (but do not trigger removal)", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should('exist')
    cy.get('[data-cy="delete-answer-collection"]').should('not.exist')
  })

  it("Verify that user 'pro2' can use the answer collection in a question", function () {
    cy.loginInstitutionalCatalyst()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.access.name,
      correctAnswers: this.data.access.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_INST_ID'),
    })
  })

  it("Verify that user 'pro2' can no longer remove the used answer collection", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it("Use the write permissions of user 'pro3' to make changes to the answer collection", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').should('exist')
    testAnswerCollectionEditPermissions(this.data)
  })

  it('Verify as an owner that the changes persist and undo them', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').should('exist')
    validateAndUndoWritePermissionChanges(this.data)
  })

  it("Verify that user 'pro3' can both remove and delete the answer collection (but do not trigger either", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should('exist')
    cy.get('[data-cy="delete-answer-collection"]').should('exist')
  })

  it("Verify that user 'pro3' can use the answer collection in a question", function () {
    cy.loginInstitutionalCatalyst2()
    cy.createQuestionSE({
      name: this.data.question.title,
      content: this.data.question.content,
      numberOfInputs: this.data.question.numberOfInputs,
      collectionName: this.data.access.name,
      correctAnswers: this.data.access.items.filter((_, i) =>
        this.data.question.solutions.includes(i)
      ),
      userId: Cypress.env('LECTURER_INST2_ID'),
    })
  })

  it("Verify that user 'pro3' can no longer remove or delete the used answer collection", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
  })

  it("Verify that user 'pro3' can open the sharing dialogue and has access to all permissions with the correct values", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // verify that all permissions are visible
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro3' can modify the permissions of user 'pro1' to WRITE", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // change the permissions of user pro1 to WRITE
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsWRITE)
  })

  it("Verify that user 'pro1' has been granted write permissions and test edit permissions", function () {
    cy.loginIndividualCatalyst()
    testAnswerCollectionEditPermissions(this.data)
  })

  it('Verify as an owner that the changes persist, undo them and change the permissions back to read level', function () {
    cy.loginLecturer()
    validateAndUndoWritePermissionChanges(this.data)
    cy.get('[data-cy="close-answer-collection-edit-modal"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsWRITE)
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsREAD)

    // verify that direct permissions can be revoked (despite being used) --> however derived permissions would be created automatically
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.be.disabled')
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.be.disabled')
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.be.disabled')
  })

  it("Verify that user 'pro1' has read permissions again and can view the answer collection", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.access.name}"]`).should(
      'exist'
    )

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').should('not.exist')
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.access.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Remove the created question for user 'pro1'", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.deleteElement({ elementName: this.data.question.title })
  })

  it("Revoke the access to the user collection for user 'pro1'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')

    // verify that no derived permissions are shown in the corresponding list
    cy.get('[data-cy="show-derived-permissions"]').click()
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')

    // verify that the remaining permissions can be removed (derived permissions are created though)
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-revocation"]').click()
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.be.disabled')

    // verify that for the users that were granted derived permissions, corresponding entries are shown
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')

    // hide the derived permissions again and verify that the corresponding entries are not shown
    cy.get('[data-cy="hide-derived-permissions"]').click()
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="derived-permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
  })

  it("Cleanup: Remove the created question and answer collection for user 'pro2'", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="library"]').click()
    cy.deleteElement({ elementName: this.data.question.title })

    // for revoked permission, the derived one should automatically be removed on deletion of the corresponding element
    cy.reload()
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.access.name}"]`
    ).should('not.exist')
  })

  it("Cleanup: Remove the created question and answer collection for user 'pro3'", function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="library"]').click()
    cy.deleteElement({ elementName: this.data.question.title })
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    removeAnswerCollection({ name: this.data.access.name })
  })

  it('Cleanup: Delete the answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.access.name })
  })
  // #endregion

  // ! 8. Miscellaneous (e.g. ownership transfer)
  // #region
  it('Create a new answer collection', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.ownership.name,
      description: this.data.ownership.description,
      entries: this.data.ownership.items,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it("Grant READ permissions to user 'pro1'", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // directly add permission for user pro1
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').type(
      Cypress.env('LECTURER_IND_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()

    // verify that permission has been created correctly
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it("Transfer ownership to user 'pro2' using the e-mail address", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="transfer-ownership"]').click()

    // transfer ownership to user pro2
    cy.get('[data-cy="cancel-ownership-transfer"]').click()
    cy.get('[data-cy="transfer-ownership"]').click()
    cy.get('[data-cy="new-owner-username-email-input"]').type(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get('[data-cy="confirm-ownership-transfer"]').click()

    // verify that admin permission has been created for pervious owner, but ownership transfer functionality is not visible anymore
    cy.get('[data-cy="transfer-ownership"]').should('not.exist')
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro2' is the new owner with an overview of all permissions", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // verify that all permissions are visible
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro1' still has read access to the answer collection", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-${this.data.ownership.name}"]`).should(
      'exist'
    )

    // validate content of viewing modal
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.ownership.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it("Transfer ownership to user 'pro1' using the username", function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="transfer-ownership"]').click()
    cy.get('[data-cy="new-owner-username-email-input"]').type(
      Cypress.env('LECTURER_IND_SHORTNAME')
    )
    cy.get('[data-cy="confirm-ownership-transfer"]').click()

    // verify that the correct permissions are displayed
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it("Verify that user 'pro1' is the new owner with an overview of all permissions", function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    // verify that all permissions are visible
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Change own access rights from admin permissions to read access for main user', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="cancel-modify-own-permissions"]').click()
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="confirm-modify-own-permissions"]').click()

    // modal has been closed and permission updated
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="answer-collection-${this.data.ownership.name}"]`
    ).contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').should('not.exist')
    cy.get('[data-cy="edit-answer-collection"]').should('not.exist')
    cy.get('[data-cy="view-answer-collection"]').click()
    cy.get('[data-cy="open-collection-options"]').click()
    cy.wrap(this.data.ownership.items).each((value: string) => {
      cy.findByText(value).should('exist')
    })
  })

  it('Change the main users access rights back to admin permissions', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsREAD)
    cy.get(
      `[data-cy="permission-level-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Have the main user revoke its own access through the use of admin rights', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()

    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).contains(messages.manage.sharing.permissionsADMIN)
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="cancel-modify-own-permissions"]').click()
    cy.get(
      `[data-cy="revoke-permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()
    cy.get('[data-cy="confirm-modify-own-permissions"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('not.exist')
  })

  it('Verify that the main user has no permissions on the collection anymore', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.ownership.name}"]`
    ).click()
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get(
      `[data-cy="permission-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('not.exist')
  })

  it('Cleanup: Remove the answer collection from user pro2', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    removeAnswerCollection({ name: this.data.ownership.name })
  })

  it('Cleanup: Delete the answer collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.ownership.name })
  })
  // #endregion
})
