import { CatalogObjectType } from '@klicker-uzh/types'
import messages from '../../../packages/i18n/messages/en'

describe('Test all functionalities of catalog collections and objects contained therein', function () {
  beforeEach('Load fixture for this test case', function () {
    cy.fixture('L-catalog.json').then((data) => {
      this.data = data
    })
    cy.fixture('questions.json').then((data) => {
      this.data = { ...this.data, ...data }
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Helpers
  function verifyAdminOwnerPermissionsCCPublic({
    data,
    ownership,
  }: {
    data: any
    ownership: boolean
  }) {
    cy.get(
      `[data-cy="catalog-collection-${data.CCPublic}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]').should('exist')
    cy.get('[data-cy="transfer-ownership"]').should(
      ownership ? 'exist' : 'not.exist'
    )
    cy.get('[data-cy="close-share-object"]').click()

    cy.get(
      `[data-cy="catalog-collection-${data.CCPublic}-actions"]`
    ).realClick()
    cy.get('[data-cy="delete-catalog-collection"]').click()
    cy.get('[data-cy="cancel-delete-collection"]').click()

    cy.get(
      `[data-cy="change-catalog-collection-name-${data.CCPublic}"]`
    ).realClick()
    cy.get('[data-cy="insert-catalog-collection-name"]')
      .click()
      .clear()
      .type(`${data.CCPublic} NEW`)
    cy.get('[data-cy="catalog-collection-name-change-confirm"]').click()
    cy.get(`[data-cy="catalog-object-${data.CCPublic} NEW"]`).should('exist')
    cy.get(
      `[data-cy="change-catalog-collection-name-${data.CCPublic} NEW"]`
    ).realClick()
    cy.get('[data-cy="insert-catalog-collection-name"]')
      .click()
      .clear()
      .type(`${data.CCPublic}`)
    cy.get('[data-cy="catalog-collection-name-change-confirm"]').click()
    cy.get(`[data-cy="catalog-object-${data.CCPublic}"]`).should('exist')

    cy.get(`[data-cy="catalog-object-${data.CCPublic}"]`).click()
    cy.get('[data-cy="add-object-to-catalog-button"]').should('exist')
    cy.get(`[data-cy="catalog-object-${data.AC1.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(`[data-cy="actions-dropdown-${data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="remove-object-${data.AC1.name}"]`).click()
    cy.get('[data-cy="cancel-removal"]').click()

    cy.get(`[data-cy="catalog-object-${data.AC2.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)
    cy.get(`[data-cy="actions-dropdown-${data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="remove-object-${data.AC2.name}"]`).click()
    cy.get('[data-cy="cancel-removal"]').click()

    // verify that the live quiz template can be used or removed from the catalog collection
    cy.get(`[data-cy="catalog-object-${data.liveQuiz.template.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(
      `[data-cy="actions-dropdown-${data.liveQuiz.template.name}"]`
    ).realClick()
    cy.get(`[data-cy="use-template-${data.liveQuiz.template.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="remove-object-${data.liveQuiz.template.name}"]`).click()
    cy.get('[data-cy="cancel-removal"]').click()
  }

  // ! Part 1: Creation of Catalog Collections and Content
  // #region
  it('Create a new answer collection AC1 in lecturer account', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.AC1.name,
      description: this.data.AC1.description,
      entries: this.data.AC1.items,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.get(`[data-cy="answer-collection-${this.data.AC1.name}"]`).should(
      'exist'
    )
  })

  it('Create a new answer collection AC2 in pro1 account', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.AC2.name,
      description: this.data.AC2.description,
      entries: this.data.AC2.items,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.get(`[data-cy="answer-collection-${this.data.AC2.name}"]`).should(
      'exist'
    )
  })

  it('Create the questions that will be required for this test workflow', function () {
    cy.loginLecturer()
    cy.createQuestionSC({
      name: this.data.SC.title,
      content: this.data.SC.content,
      choices: this.data.SC.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createQuestionSC({
      name: this.data.SCML.title,
      content: this.data.SCML.content,
      choices: this.data.SCML.choices,
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Create a live quiz template', function () {
    cy.loginLecturer()

    cy.createLiveQuiz({
      name: this.data.liveQuiz.name,
      displayName: this.data.liveQuiz.displayName,
      courseName: this.data.liveQuiz.course,
      blocks: [{ elements: [this.data.SC.title, this.data.SCML.title] }],
    })
    cy.get('[data-cy="open-activity-overview"]').click()

    cy.convertLiveQuizToTemplate({
      liveQuiz: this.data.liveQuiz.name,
      name: this.data.liveQuiz.template.name,
      description: this.data.liveQuiz.template.description,
      instructions: this.data.liveQuiz.template.instructions,
      copyBeforeConversion: false,
      resourceAccessRequired: false,
    })
  })

  it('Share the answer collection AC1 with other users', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.AC1.name}"]`
    ).click()

    // ADMIN permissions for user pro1
    cy.get('[data-cy="share-answer-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)

    // WRITE permissions for user pro2
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST_EMAIL'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // READ permissions for user pro3
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it('Create public and private catalog collections CCPublic and CCPrivate', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // create public catalog collection
    cy.get('[data-cy="create-catalog-collection-button"]').click()
    cy.get('[data-cy="catalog-collection-name-input"]')
      .click()
      .type(this.data.CCPublic)
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[data-cy="create-catalog-collection-submit"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)

    // create a restricted catalog collection
    cy.get('[data-cy="create-catalog-collection-button"]').click()
    cy.get('[data-cy="catalog-collection-name-input"]')
      .click()
      .type(this.data.CCRestricted)
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-restricted"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[data-cy="create-catalog-collection-submit"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)
  })

  it('Verify correct visibility of catalog collections to users', function () {
    // lecturer should be able to see both catalog collections
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).should(
      'exist'
    )
    cy.logoutLecturer()

    // other users should not see empty public collection (restricted for access requests)
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).should(
      'exist'
    )
  })

  it('Add AC1 to both catalog collections', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add AC1 as public object to public catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCPublic)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-public"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.AC1.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`).should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )

    // add AC1 as public object to restricted catalog collection
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCRestricted)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-public"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.AC1.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`).should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`).contains(
      messages.manage.catalog.accessPUBLIC
    )
  })

  it('Verify that both catalog collections are visible to all users', function () {
    // lecturer should be able to see both catalog collections
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).should(
      'exist'
    )
    cy.logoutLecturer()

    // other users should also see both catalog collections and content of public one
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).should(
      'exist'
    )

    // navigating into public collection reveals content (no access permissions required)
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`).should('exist')

    // clicking onto restricted catalog collection opens request modal
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').should('exist')
  })
  // #endregion

  // ! Part 2: Sharing of Catalog Collections
  // #region
  it('Request access to CCRestricted from pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="confirm-request-access"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).should('not.exist')
  })

  it('Share CCRestricted with all other users and different permission levels (request approval & direct sharing)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // Approve request for user pro1 (WRITE permissions)
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.CCRestricted}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="deny-sharing-request-${this.data.CCRestricted}-pro1"]`
    ).should('exist')
    cy.get(
      `[data-cy="approve-sharing-request-${this.data.CCRestricted}-pro1"]`
    ).click()
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="permission-level-select"]').click()
    cy.get('[data-cy="permission-level-WRITE"]').click()
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="confirm-approval"]').click()

    // Share directly with pro2 (ADMIN permissions)
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)

    // Share directly with pro3 (READ permissions)
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-READ"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)
  })

  it('Share CCPublic with user pro1 and ADMIN permissions', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCPublic}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.get('[data-cy="new-permission-access-level"]').click()
    cy.get('[data-cy="permission-level-ADMIN"]').click()
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click()
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Add AC2 to both catalog collections with restricted visibility using WRITE / ADMIN permissions respectively', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add AC2 as restricted object to public catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCPublic)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-restricted"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.AC2.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.AC2.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)

    // add AC2 as restricted object to restricted catalog collection
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCRestricted)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.ANSWER_COLLECTION}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-restricted"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.AC2.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.AC2.name}"]`).contains(
      messages.manage.catalog.accessRESTRICTED
    )
  })

  it('Add the live quiz template to the top level of the catalog and both collections', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add live quiz template to public catalog collection (public object)
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCPublic)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.LIVE_QUIZ_TEMPLATE}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-public"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.liveQuiz.template.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.liveQuiz.template.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)

    // TODO: change the object access of this live quiz template to restricted (once supported)
    // add live quiz template to the restricted catalog collection (public object)
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCRestricted)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').click()
    cy.get(
      `[data-cy="object-type-${CatalogObjectType.LIVE_QUIZ_TEMPLATE}"]`
    ).click()
    cy.get('[data-cy="modal-object-access"]').click()
    cy.get('[data-cy="object-access-public"]').click()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.liveQuiz.template.name
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(
      `[data-cy="catalog-object-${this.data.liveQuiz.template.name}"]`
    ).contains(messages.manage.catalog.accessPUBLIC)
  })

  it('Verify that the permissions on the catalog collections are correctly set for lecturer', function () {
    // test owner privileges on public catalog collection (share, transfer ownership, delete, edit)
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    verifyAdminOwnerPermissionsCCPublic({ data: this.data, ownership: true })

    // minimal testing of owner privileges on restricted catalog collection
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
    cy.get('[data-cy="transfer-ownership"]').should('exist')
    cy.get('[data-cy="new-permission-username-or-email"]').should('exist')
    cy.get('[data-cy="close-share-object"]').click()

    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).realClick()
    cy.get('[data-cy="delete-catalog-collection"]').click()
    cy.get('[data-cy="cancel-delete-collection"]').click()
  })

  it('Verify that the permissions on the catalog collections are correctly set for pro1', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // test availability of ADMIN permissions for user pro1 on public catalog collection
    verifyAdminOwnerPermissionsCCPublic({ data: this.data, ownership: false })

    // test availability of WRITE permissions for user pro1 on restricted catalog collection (can modify object assignments)
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).should('not.exist')
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="add-object-to-catalog-button"]').should('exist')
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="remove-object-${this.data.AC1.name}"]`).click()
    cy.get('[data-cy="cancel-removal"]').click()

    cy.get(`[data-cy="catalog-object-${this.data.AC2.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="remove-object-${this.data.AC2.name}"]`).click()
    cy.get('[data-cy="cancel-removal"]').click()

    // test that the live quiz templates can be used or removed from the catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.liveQuiz.template.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(
      `[data-cy="actions-dropdown-${this.data.liveQuiz.template.name}"]`
    ).realClick()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template.name}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-object-${this.data.liveQuiz.template.name}"]`
    ).click()
    cy.get('[data-cy="cancel-removal"]').click()
  })

  it('Verify that user pro2 without permissions on the public catalog collection can see and request / import content', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // verify that public catalog collection can be opened, AC1 (public) already access granted, AC2 (restricted) access requestable
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessGranted)
    cy.get(`[data-cy="${this.data.AC1.name}-object-access"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="${this.data.AC2.name}-object-access"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="add-object-to-catalog-button"]').should('not.exist')

    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-request-access"]`).click()

    // test that the live quiz templates can be used
    cy.get(
      `[data-cy="actions-dropdown-${this.data.liveQuiz.template.name}"]`
    ).realClick()
    cy.get(
      `[data-cy="use-template-${this.data.liveQuiz.template.name}"]`
    ).click() // open template
    cy.get(`[data-cy="live-quiz-template-submit"]`).should('exist') // check that template was loaded

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click() // navigate back to catalog collection
  })

  it('Verify that user pro3 can see and request access to objects in restricted answer collection with READ permissions', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // verify that READ access on restricted catalog collection can be used to open and request objects
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessGranted)
    cy.get(`[data-cy="${this.data.AC1.name}-object-access"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="${this.data.AC2.name}-object-access"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="add-object-to-catalog-button"]').should('not.exist')

    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="request-access-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-request-access"]`).click()
  })
  // #endregion

  // ! Part 3: Object Sharing
  // #region
  it('Verify that the permissions on the objects themselves (sharing, etc.) are determined by object access', function () {
    // main lecturer - OWNER of AC1 and no access to AC2 with corresponding sharing permissions
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC1.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('exist')
    cy.get('[data-cy="close-share-object"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).should('not.exist')
    cy.get(`[data-cy="request-access-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-request-access"]`).click()

    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC1.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('exist')
    cy.get('[data-cy="close-share-object"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).should('not.exist')
    cy.get(`[data-cy="request-access-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-request-access"]`).click()
    cy.logoutLecturer()

    // pro1 - ADMIN of AC1 and OWNER of AC2 with corresponding sharing permissions
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC1.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('not.exist')
    cy.get('[data-cy="close-share-object"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('exist')
    cy.get('[data-cy="close-share-object"]').click()

    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC1.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('not.exist')
    cy.get('[data-cy="close-share-object"]').click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).click()
    cy.get('[data-cy="transfer-ownership"]').should('exist')
    cy.get('[data-cy="close-share-object"]').click()
    cy.logoutLecturer()

    // pro2 - ADMIN of catalog collection CC2 but without permissions on answer collections should not be able to access sharing dialogs
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get(`[data-cy="catalog-object-${this.data.AC1.name}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessGranted)
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).should(
      'not.exist'
    ) // actions not available - not sufficient permissions on object OR catalog collection
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).should('not.exist')
    cy.get(`[data-cy="request-access-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-request-access"]`).click()

    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC1.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC1.name}"]`).should('not.exist')
    cy.get(`[data-cy="remove-object-${this.data.AC1.name}"]`).click()
    cy.get(`[data-cy="cancel-removal"]`).click()
    cy.get(`[data-cy="actions-dropdown-${this.data.AC2.name}"]`).realClick()
    cy.get(`[data-cy="share-object-${this.data.AC2.name}"]`).should('not.exist')
    cy.get(`[data-cy="remove-object-${this.data.AC2.name}"]`).click()
    cy.get(`[data-cy="cancel-removal"]`).click()
  })
  // #endregion

  // ! Part 4: User Groups
  // #region
  it('Create a user group with regular members and admins', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.userGroup.name)
    cy.get('[data-cy="cancel-create-user-group"]').click()

    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.userGroup.name)

    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME')) // pro1 is added as admin
    cy.get('[data-cy="member-admin-0"]').realClick()

    cy.get('[data-cy="add-member"]').click()
    cy.get('[data-cy="member-shortname-email-1"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL')) // pro2 is added as admin
    cy.get('[data-cy="member-admin-1"]').realClick()

    cy.get('[data-cy="add-member"]').click()
    cy.get('[data-cy="member-shortname-email-2"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME')) // pro3 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()

    // check that the user group has been created correctly
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="edit-group-name"]`).should('exist')
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
  })

  it('Verify that the other group members and admins can see the group, its members and appropriate actions', function () {
    // log in as the group owner and verify that all actions are available
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.shared.generic.owner
    )
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="delete-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_EMAIL')
    )

    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(Cypress.env('LECTURER_IND_EMAIL'))
    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(Cypress.env('LECTURER_INST_EMAIL'))
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    )
      .should('exist')
      .contains(Cypress.env('LECTURER_INST2_EMAIL'))

    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')

    cy.get(
      `[data-cy="promote-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.logoutLecturer()

    // log in as an admin user, verify that all functionalities except from ownership transfer are available
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.admin
    )
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="leave-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_EMAIL')
    )

    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(Cypress.env('LECTURER_IND_EMAIL'))
    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(Cypress.env('LECTURER_INST_EMAIL'))
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    )
      .should('exist')
      .contains(Cypress.env('LECTURER_INST2_EMAIL'))

    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')

    cy.get(
      `[data-cy="promote-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="remove-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.logoutLecturer()

    // log in as a member user, verify that no modification actions are available and that the user emails are not shown
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.member
    )
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="leave-group-${this.data.userGroup.name}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_EMAIL')
    )

    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .should('not.contain', Cypress.env('LECTURER_IND_EMAIL'))
    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .should('not.contain', Cypress.env('LECTURER_INST_EMAIL'))
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    )
      .should('exist')
      .should('not.contain', Cypress.env('LECTURER_INST2_EMAIL'))

    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="promote-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="remove-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
    cy.logoutLecturer()
  })

  it('Verify that creating another group with the same name fails', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get('[data-cy="create-user-group"]').click()
    cy.get('[data-cy="user-group-name"]').click().type(this.data.userGroup.name)
    cy.get('[data-cy="member-shortname-email-0"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME')) // pro3 is added as member
    cy.get('[data-cy="submit-create-user-group"]').click()
    cy.get('[data-cy="user-group-creation-error-toast"]').should('exist') // error toast should be shown
  })

  it('Verify that a group can be left by admins and users', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="leave-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="cancel-leave-group"]').click()
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="leave-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="confirm-leave-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )

    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="leave-group-${this.data.userGroup.name}"]`).click()
    cy.get('[data-cy="confirm-leave-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )
  })

  it("Re-add the member and admin again using the add to group functionality and verify the action's success through the corresponding users", function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')

    // re-add user pro1 as an admin and user pro3 as a member
    cy.get('[data-cy="add-admin-group-input"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.get('[data-cy="add-admin-group-confirm"]').click()
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="add-admin-group-input"]').should('have.value', '') // form should be cleared on success

    cy.get('[data-cy="add-member-group-input"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.get('[data-cy="add-member-group-confirm"]').click()
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')
    cy.get('[data-cy="add-member-group-input"]').should('have.value', '') // form should be cleared on success
  })

  it('Promote and demote two different users and check the persistence of this change through the corresponding accounts', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()

    // promote user pro3 to admin
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    )
      .should('exist')
      .contains(Cypress.env('LECTURER_INST2_EMAIL'))
    cy.get(
      `[data-cy="promote-group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('exist')

    // demote user pro1 to member
    cy.get(`[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(Cypress.env('LECTURER_IND_EMAIL'))
    cy.get(
      `[data-cy="demote-group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.logoutLecturer()

    // verify that the changes went into effect for the corresponding users
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.member
    )
    cy.logoutLecturer()

    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.admin
    )
    cy.logoutLecturer()
  })

  it('Remove a member and an admin from the group and verify that the corresponding users lost access', function () {
    // remove the promoted and demoted users from the group
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()

    cy.get(
      `[data-cy="remove-group-admin-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST2_SHORTNAME')}"]`
    ).should('not.exist')

    cy.get(
      `[data-cy="remove-group-member-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="group-member-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.logoutLecturer()

    // verify that the changes went into effect for the corresponding users
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )
    cy.logoutLecturer()

    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )
    cy.logoutLecturer()
  })

  it('Transfer the ownership to one of the group admins, verify the change and transfer the ownership back', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()

    // verify that the ownership transfer was successful (and user themselves is added as an admin)
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_INST_SHORTNAME')
    )
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_INST_EMAIL')
    )
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('exist')
    cy.logoutLecturer()

    // verify that the changes went into effect for the corresponding users and transfer the ownership back
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()
    cy.get(
      `[data-cy="transfer-group-ownership-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).click()

    // verify that the ownership transfer was successful (and user themselves is added as an admin)
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get('[data-cy="group-owner-shortname-email"]').contains(
      Cypress.env('LECTURER_EMAIL')
    )
    cy.get(
      `[data-cy="group-admin-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')
    cy.logoutLecturer()
  })

  it('Change the name of the user group and verify its persistence', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-actions-${this.data.userGroup.name}"]`).click()
    cy.get(`[data-cy="view-edit-group-${this.data.userGroup.name}"]`).click()

    cy.get('[data-cy="edit-group-name"]').click()
    cy.get('[data-cy="edit-group-name-input"]')
      .click()
      .clear()
      .type(this.data.userGroup.nameNew)
    cy.get('[data-cy="save-new-group-name"]').click()
    cy.get('[data-cy="edit-group-name-input"]').should('not.exist')
    cy.get('[data-cy="close-user-group-edit-modal"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.nameNew}"]`).should(
      'exist'
    )
  })

  it('Delete the user group and verify that it is not shown anymore to any members', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.nameNew}"]`).should(
      'exist'
    )
    cy.get(
      `[data-cy="user-group-actions-${this.data.userGroup.nameNew}"]`
    ).click()
    cy.get(`[data-cy="delete-group-${this.data.userGroup.nameNew}"]`).click()
    cy.get('[data-cy="cancel-delete-group"]').click()

    cy.get(
      `[data-cy="user-group-actions-${this.data.userGroup.nameNew}"]`
    ).click()
    cy.get(`[data-cy="delete-group-${this.data.userGroup.nameNew}"]`).click()

    cy.get('[data-cy="confirm-delete-group"]').should('be.disabled')
    cy.get('[data-cy="delete-group-resolve-group-confirm"]').click()
    cy.get('[data-cy="confirm-delete-group"]').should('be.disabled')
    cy.get('[data-cy="delete-group-revoke-permissions-confirm"]').click()
    cy.get('[data-cy="confirm-delete-group"]').should('be.disabled')
    cy.get('[data-cy="delete-group-irrevocable-action-confirm"]').click()
    cy.get('[data-cy="confirm-delete-group"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.nameNew}"]`).should(
      'not.exist'
    )
    cy.logoutLecturer()

    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.nameNew}"]`).should(
      'not.exist'
    )
    cy.logoutLecturer()
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Remove the shared answer collection from all accounts and delete it', function () {
    // remove the shared answer collections from pro1
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.AC1.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-object"]').click()
    cy.logoutLecturer()

    // remove the shared answer collections from pro2
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.AC1.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-object"]').click()
    cy.logoutLecturer()

    // remove the shared answer collections from pro3
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.AC1.name}"]`
    ).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-object"]').click()
    cy.logoutLecturer()

    // delete answer collection AC1
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.AC1.name })
    cy.logoutLecturer()

    // delete answer collection AC2
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.AC2.name })
  })

  it('Cleanup: Delete the live quiz template', function () {
    cy.loginLecturer()

    cy.get('[data-cy="live-quizzes"]').click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.template.name}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete all questions that have been created', function () {
    cy.loginLecturer()
    cy.deleteElement({ elementName: this.data.SC.title })
    cy.deleteElement({ elementName: this.data.SCML.title })
  })

  it('Cleanup: Remove the two catalog collections through the lecturer account (owner)', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    cy.get(
      `[data-cy="catalog-collection-${this.data.CCPublic}-actions"]`
    ).realClick()
    cy.get('[data-cy="delete-catalog-collection"]').click()
    cy.get('[data-cy="confirm-delete-collection"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).realClick()
    cy.get('[data-cy="delete-catalog-collection"]').click()
    cy.get('[data-cy="confirm-delete-collection"]').click()

    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Verify that the answer collections and catalog collections have been deleted properly and are not visible anymore', function () {
    cy.loginLecturer()

    // validate that no collections except from the seeded ones remain
    cy.task('verifyDeletionAnswerCollections').then((result) => {
      if (result === null || result === false) {
        throw new Error(
          'The database contains answer collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })

    // validate that no catalog collections except from the seeded ones remain
    cy.task('verifyDeletionCatalogCollections').then((result) => {
      if (result === null || result === false) {
        throw new Error(
          'The database contains catalog collections beyond the seeded ones.'
        )
      }

      // dummy action
      cy.visit(Cypress.env('URL_MANAGE'))
    })
  })
  // #endregion
})
