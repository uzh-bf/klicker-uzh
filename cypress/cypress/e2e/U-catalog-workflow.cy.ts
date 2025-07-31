import messages from '../../../packages/i18n/messages/en'

describe('Test all functionalities of catalog collections and objects contained therein', function () {
  before(() => {
    cy.seed()
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setLocaleOverride',
      params: { locale: 'en' },
    })
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Load fixture for this test case', function () {
    cy.fixture('U-catalog.json').then((data) => {
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
    elementOwnership,
  }: {
    data: any
    ownership: boolean
    elementOwnership: boolean
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
    cy.get('[data-cy="leave-catalog-collection"]').click()

    // verify that the selection questions can be imported or requested from the catalog collection
    cy.get(`[data-cy="catalog-object-${data.SEML.title}"]`)
      .should('exist')
      .should(
        elementOwnership ? 'contain' : 'not.contain',
        messages.manage.catalog.accessRESTRICTED
      ) // user not admin on object -> object permissions relevant in top-level catalog collection
    cy.get(`[data-cy="actions-dropdown-${data.SEML.title}"]`).realClick()
    cy.get(`[data-cy="copy-object-${data.SEML.title}"]`).should('not.exist') // restricted objects cannot be imported
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="request-access-${data.SEML.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }

    cy.get(`[data-cy="catalog-object-${data.SEML2.title}"]`)
      .should('exist')
      .should(
        elementOwnership ? 'contain' : 'not.contain',
        messages.manage.catalog.accessPUBLIC
      ) // user not admin on object -> object permissions relevant in top-level catalog collection
    cy.get(`[data-cy="actions-dropdown-${data.SEML2.title}"]`).realClick()
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="copy-object-${data.SEML2.title}"]`).should('exist')
      cy.get(`[data-cy="request-access-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }

    // move into catalog collection (public)
    cy.get(`[data-cy="catalog-object-${data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(data.CCPublic)
    cy.get(`[data-cy="catalog-object-${data.SEML.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)
    cy.get(`[data-cy="actions-dropdown-${data.SEML.title}"]`).realClick()
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="copy-object-${data.SEML.title}"]`).should('not.exist') // restricted objects cannot be imported
      cy.get(`[data-cy="request-access-${data.SEML.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }

    cy.get(`[data-cy="catalog-object-${data.SEML2.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(`[data-cy="actions-dropdown-${data.SEML2.title}"]`).realClick()
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="copy-object-${data.SEML2.title}"]`).should('exist')
      cy.get(`[data-cy="request-access-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${data.CCRestricted}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(data.CCRestricted)
    cy.get(`[data-cy="catalog-object-${data.SEML.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)
    cy.get(`[data-cy="actions-dropdown-${data.SEML.title}"]`).realClick()
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="copy-object-${data.SEML.title}"]`).should('not.exist') // restricted objects cannot be imported
      cy.get(`[data-cy="request-access-${data.SEML.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }

    cy.get(`[data-cy="catalog-object-${data.SEML2.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
    cy.get(`[data-cy="actions-dropdown-${data.SEML2.title}"]`).realClick()
    if (elementOwnership) {
      cy.get(`[data-cy="share-object-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="close-share-object"]').click()
    } else {
      cy.get(`[data-cy="copy-object-${data.SEML2.title}"]`).should('exist')
      cy.get(`[data-cy="request-access-${data.SEML2.title}"]`).click()
      cy.get('[data-cy="cancel-request-access"]').click()
    }
  }

  // ! Part 1: Creation of Catalog Collections and Content
  // #region
  it('Create a new answer collection AC1 in the lecturer account', function () {
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

  it('Create a new answer collection AC2 in the pro1 account', function () {
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

  it('Create two new selection questions in the pro1 account', function () {
    cy.loginIndividualCatalyst()
    cy.createQuestionSE({
      name: this.data.SEML.title,
      content: this.data.SEML.content,
      numberOfInputs: this.data.SEML.inputs,
      collectionName: this.data.AC2.name,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.get(`[data-cy="element-item-${this.data.SEML.title}"]`).should('exist')
    cy.createQuestionSE({
      name: this.data.SEML2.title,
      content: this.data.SEML2.content,
      numberOfInputs: this.data.SEML2.inputs,
      collectionName: this.data.AC2.name,
      userId: Cypress.env('LECTURER_IND_ID'),
    })
    cy.get(`[data-cy="element-item-${this.data.SEML2.title}"]`).should('exist')
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
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)

    // WRITE permissions for user pro2
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST_EMAIL'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // READ permissions for user pro3
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
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
    cy.logoutUser()

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
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ANSWER_COLLECTION"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
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
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ANSWER_COLLECTION"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
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
    cy.logoutUser()

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

    // approve request for user pro1 (WRITE permissions)
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
    cy.get('[data-cy="permission-level-select"]').realClick()
    cy.get('[data-cy="permission-level-WRITE"]').realClick()
    cy.get('[data-cy="permission-level-select"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="confirm-approval"]').click()

    // share directly with pro2 (ADMIN permissions)
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST_EMAIL'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)

    // share directly with pro3 (READ permissions)
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .clear()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
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
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Add the second answer collection to both catalog collections with restricted visibility using WRITE / ADMIN permissions respectively', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add AC2 as restricted object to public catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCPublic)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ANSWER_COLLECTION"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
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
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ANSWER_COLLECTION"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
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
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-LIVE_QUIZ_TEMPLATE"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
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
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-LIVE_QUIZ_TEMPLATE"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
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

  it('Add the selection questions to the catalog collections and the top-level catalg collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()

    // add the two selection questions to the top level of the catalog collection
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML2.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML2.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)

    // add the selection queestions as public and restricted objects to the public catalog collection
    cy.get(`[data-cy="catalog-object-${this.data.CCPublic}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCPublic)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML2.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML2.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)

    // add the selection questions as public and restricted objects to the restricted catalog collection
    cy.get('[data-cy="leave-catalog-collection"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(this.data.CCRestricted)
    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-0"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)

    cy.get('[data-cy="add-object-to-catalog-button"]').click()
    cy.get('[data-cy="object-type-selection"]').realClick()
    cy.get(`[data-cy="object-type-ELEMENT"]`).realClick()
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-public"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessPUBLIC
    )
    cy.get('[id="object-selection-catalog-addition"]').click()
    cy.get(
      '[id="react-select-object-selection-catalog-addition-option-1"]'
    ).click()
    cy.get('[id="object-selection-catalog-addition"]').contains(
      this.data.SEML2.title
    )
    cy.get('[data-cy="submit-add-object-button"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.SEML2.title}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessPUBLIC)
  })

  it('Verify that the permissions on the catalog collections are correctly set for lecturer', function () {
    // test owner privileges on public catalog collection (share, transfer ownership, delete, edit)
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    verifyAdminOwnerPermissionsCCPublic({
      data: this.data,
      ownership: true,
      elementOwnership: false,
    })

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
    verifyAdminOwnerPermissionsCCPublic({
      data: this.data,
      ownership: false,
      elementOwnership: true,
    })

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

  it('Create user groups with all users and prepare a new catalog collection for user group sharing', function () {
    // create catalog collection with restricted access
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get('[data-cy="create-catalog-collection-button"]').click()
    cy.get('[data-cy="catalog-collection-name-input"]')
      .click()
      .type(this.data.CCRestricted2)
    cy.get('[data-cy="modal-object-access"]').realClick()
    cy.get('[data-cy="object-access-restricted"]').realClick()
    cy.get('[data-cy="modal-object-access"]').contains(
      messages.manage.catalog.accessRESTRICTED
    )
    cy.get('[data-cy="create-catalog-collection-submit"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted2}"]`)
      .should('exist')
      .contains(messages.manage.catalog.accessRESTRICTED)

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

  it('Grant direct READ, WRITE and ADMIN permissions to the catalog collection for the user groups', function () {
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(
      `[data-cy="catalog-collection-${this.data.CCRestricted2}-actions"]`
    ).realClick()
    cy.get('[data-cy="share-catalog-collection"]').click()

    // grant direct READ permissions to group 1
    cy.get('[data-cy="new-permission-submit"]').should('be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_IND_SHORTNAME'))
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').should(
      'have.value',
      Cypress.env('LECTURER_IND_SHORTNAME')
    )

    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption('[data-cy="new-permission-user-group"]', this.data.group1)
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group1)
    cy.get('[data-cy="new-permission-username-or-email"]').should(
      'have.value',
      ''
    ) // username field should have been cleared automatically
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')

    // entering a username again, should reset the user group field
    cy.get('[data-cy="new-permission-username-or-email"]')
      .click()
      .type(Cypress.env('LECTURER_INST2_SHORTNAME'))
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.get('[data-cy="new-permission-username-or-email"]').should(
      'have.value',
      Cypress.env('LECTURER_INST2_SHORTNAME')
    )
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )

    // select the user group again
    cy.selectOption('[data-cy="new-permission-user-group"]', this.data.group1)
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group1)

    // choose permission level for group 1 and grant direct group permission
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsREAD
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.group1}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsREAD)

    // grant direct WRITE permissions to group 2
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption('[data-cy="new-permission-user-group"]', this.data.group2)
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group2)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsWRITE
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.group2}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsWRITE)

    // grant direct ADMIN permissions to group 3
    cy.get('[data-cy="new-permission-user-group"]').contains(
      messages.manage.sharing.noUserGroupSelected
    )
    cy.selectOption('[data-cy="new-permission-user-group"]', this.data.group3)
    cy.get('[data-cy="new-permission-user-group"]').contains(this.data.group3)
    cy.get('[data-cy="new-permission-submit"]').should('not.be.disabled')
    cy.selectOption(
      '[data-cy="new-permission-access-level"]',
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-access-level"]').contains(
      messages.manage.sharing.permissionsADMIN
    )
    cy.get('[data-cy="new-permission-submit"]').click().wait(500)
    cy.get(`[data-cy="permission-${this.data.group3}"]`)
      .should('exist')
      .contains(messages.manage.sharing.permissionsADMIN)
  })

  it('Verify that the users in group 1 have been granted READ permissions on the catalog collection', function () {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted2}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(
      this.data.CCRestricted2
    )
    cy.get('[data-cy="add-object-to-catalog-button"]').should('not.exist')
  })

  it('Verify that the users in group 2 have been granted WRITE permissions on the catalog collection', function () {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted2}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(
      this.data.CCRestricted2
    )
    cy.get('[data-cy="add-object-to-catalog-button"]').should('exist')
  })

  it('Verify that the users in group 3 have been granted ADMIN permissions on the catalog collection', function () {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="catalog"]').click()
    cy.get(`[data-cy="catalog-object-${this.data.CCRestricted2}"]`).click()
    cy.get('[data-cy="catalog-browser-title"]').contains(
      this.data.CCRestricted2
    )
    cy.get('[data-cy="add-object-to-catalog-button"]').should('exist')
  })
  // #endregion

  // ! Part 3: Object Sharing
  // #region
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
    cy.logoutUser()
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
    cy.logoutUser()

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
    cy.logoutUser()

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
    cy.logoutUser()

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
    cy.logoutUser()

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
    cy.logoutUser()
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
    cy.get('[data-cy="submit-create-user-group"]').should('exist') // creation dialog should still be open (-> due to failure)
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
    cy.logoutUser()

    // verify that the changes went into effect for the corresponding users
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.member
    )
    cy.logoutUser()

    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should('exist')
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).contains(
      messages.manage.userGroups.admin
    )
    cy.logoutUser()
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
    cy.logoutUser()

    // verify that the changes went into effect for the corresponding users
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )
    cy.logoutUser()

    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.name}"]`).should(
      'not.exist'
    )
    cy.logoutUser()
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
    cy.logoutUser()

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
    cy.logoutUser()
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
    cy.logoutUser()

    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="user-groups"]').click()
    cy.get(`[data-cy="user-group-${this.data.userGroup.nameNew}"]`).should(
      'not.exist'
    )
    cy.logoutUser()
  })
  // #endregion

  // ! Cleanup
  // #region
  it('Cleanup: Delete all questions that have been created', function () {
    cy.deleteAllElements()
  })

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
    cy.logoutUser()

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
    cy.logoutUser()

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
    cy.logoutUser()

    // delete answer collection AC1
    cy.loginLecturer()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.AC1.name })
    cy.logoutUser()

    // delete answer collection AC2
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="analytics"]').should('exist')
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.deleteAnswerCollection({ collectionName: this.data.AC2.name })
  })

  it('Cleanup: Delete the live quiz template', function () {
    cy.loginLecturer()

    cy.get('[data-cy="activities"]').click()
    cy.get(
      `[data-cy="actions-LIVE_QUIZ-${this.data.liveQuiz.template.name}"]`
    ).click()
    cy.get(
      `[data-cy="delete-template-${this.data.liveQuiz.template.name}"]`
    ).click()
    cy.get('[data-cy="confirm-template-deletion"]').click()
    cy.get(`[data-cy="live-quiz-${this.data.liveQuiz.template.name}"]`).should(
      'not.exist'
    )
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
  // #endregion
})
