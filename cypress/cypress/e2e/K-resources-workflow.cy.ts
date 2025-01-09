import messages from '../../../packages/i18n/messages/en'

const publicName = 'Public Answer Collection'
const publicDescription = 'This is a public answer collection'
const restrictedName = 'Restricted Answer Collection'
const restrictedDescription = 'This is a restricted answer collection'
const privateName = 'Private Answer Collection'
const privateDescription = 'This is a private answer collection'
const privateNameNew = 'Private Answer Collection New'
const privateDescriptionNew = 'This is a new private answer collection'
const SEQuestionTitle = 'New SE Question to block deletion'

const publicItems = [
  'Red',
  'Green',
  'Blue',
  'Yellow',
  'Purple',
  'Orange',
  'Pink',
  'Black',
  'White',
  'Grey',
]
const publicItemsAfterDeletion = [
  'Red',
  'Green',
  'Blue',
  'Purple',
  'Orange',
  'Pink',
  'Black',
  'White',
  'Grey',
]
const restrictedItems = [
  'Dog',
  'Cat',
  'Fish',
  'Bird',
  'Rabbit',
  'Turtle',
  'Hamster',
]
const privateItems = [
  'Apple',
  'Banana',
  'Cherry',
  'Grape',
  'Lemon',
  'Melon',
  'Orange',
]
const privateItemsNew = [
  'Apple NEW',
  'Banana NEW',
  'Cherry NEW',
  'Grape NEW',
  'Lemon NEW',
  'Melon NEW',
  'Orange NEW',
]

describe('Create, edit and share answer collections', () => {
  // ! Creation and editing of answer collections
  // #region
  it('Create a public answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').should('exist')
    cy.get('[data-cy="cancel-create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').should('not.exist')
    cy.get('[data-cy="create-answer-collection"]').click()
    cy.get('[data-cy="answer-collection-name"]').type(publicName)
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      publicName
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
      .type(publicDescription)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(publicDescription)

    cy.get('[data-cy="response-entry-0"]').type(publicItems[0])
    cy.get('[data-cy="response-entry-0"]').should('have.value', publicItems[0])
    cy.get('[data-cy="response-entry-1"]').type(publicItems[1])
    cy.get('[data-cy="response-entry-1"]').should('have.value', publicItems[1])
    publicItems.slice(2).forEach((value, ix) => {
      cy.get('[data-cy="add-response-entry"]').click()
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).type(value)
      cy.get(`[data-cy="response-entry-${ix + 2}"]`).should('have.value', value)
    })

    cy.get(`[data-cy="response-entry-${publicItems.length - 1}"]`).should(
      'exist'
    )
    cy.get('[data-cy="remove-response-entry-3"]').click()
    cy.get(`[data-cy="response-entry-${publicItems.length - 1}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="response-entry-3"]`).should('have.value', publicItems[4])

    cy.get('[data-cy="submit-create-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="answer-collection-${publicName}"]`).contains(
      messages.manage.resources.accessPUBLIC
    )
  })

  it('Create a restricted answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: restrictedName,
      accessCy: 'restricted',
      access: messages.manage.resources.accessRESTRICTED,
      description: restrictedDescription,
      entries: restrictedItems,
    })
  })

  it('Create a private answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.createAnswerCollection({
      name: privateName,
      accessCy: 'private',
      access: messages.manage.resources.accessPRIVATE,
      description: privateDescription,
      entries: privateItems,
    })
  })

  it('Edit the private answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${privateName}"]`).click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      privateName
    )
    cy.get('[data-cy="answer-collection-name"]').clear().type(privateNameNew)
    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      privateNameNew
    )

    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(privateDescription)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .clear()
      .type(privateDescriptionNew)
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(privateDescriptionNew)
    cy.get('[data-cy="save-changes-answer-collection"]').click()

    privateItems.forEach((value) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })
    privateItems.forEach((value, ix) => {
      cy.get(`[data-cy="edit-answer-option-${value}"]`).click()
      cy.get(`[data-cy="edit-answer-option-input"]`).should('have.value', value)
      cy.get(`[data-cy="edit-answer-option-input"]`)
        .clear()
        .type(privateItemsNew[ix])
      cy.get(`[data-cy="save-edit-answer-option"]`).click()
      cy.get(`[data-cy="answer-option-${privateItemsNew[ix]}"]`).contains(
        privateItemsNew[ix]
      )
    })

    const lastElement = privateItemsNew[privateItemsNew.length - 1]
    cy.get(`[data-cy="delete-answer-option-${lastElement}"]`).click()
    cy.get(`[data-cy="answer-option-${lastElement}"]`).should('not.exist')
    cy.get(`[data-cy="add-answer-option"]`).click()
    cy.get(`[data-cy="input-new-answer-option"]`).type(lastElement)
    cy.get(`[data-cy="save-new-answer-option"]`).click()
    cy.get(`[data-cy="answer-option-${lastElement}"]`).contains(lastElement)
  })

  it('Verify that the changes to the private answer collection persist', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${privateNameNew}"]`).click()

    cy.get('[data-cy="answer-collection-name"]').should(
      'have.value',
      privateNameNew
    )
    cy.get('[data-cy="answer-collection-description"]')
      .realClick()
      .contains(privateDescriptionNew)
    privateItemsNew.forEach((value, ix) => {
      cy.get(`[data-cy="answer-option-${value}"]`).contains(value)
    })
  })

  it('Verify that all three answer collections can be used in selection questions by owner', () => {
    cy.loginLecturer()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(`[data-cy="select-answer-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="select-answer-collection-${restrictedName}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="select-answer-collection-${privateNameNew}"]`).should(
      'exist'
    )
  })

  it('Verify that the public answer collection can be switched to private if no other users have access', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
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

  it('Verify that the restricted answer collection can be switched to private if no other users have access', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
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
  it('Request access to the restricted answer collection for user pro1', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // test filters and then request access
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'exist'
    )

    // test search
    cy.get('[data-cy="search-answer-collection"]').click().type(publicName)
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="search-answer-collection"]')
      .click()
      .clear()
      .type(restrictedName)
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'exist'
    )
    cy.get('[data-cy="search-answer-collection"]').click().clear()

    // test type filter
    cy.get('[data-cy="answer-collection-access-filter"]').contains(
      messages.manage.resources.all
    )
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-public"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'not.exist'
    )
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-restricted"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'exist'
    )
    cy.get('[data-cy="answer-collection-access-filter"]').click()
    cy.get('[data-cy="answer-collection-access-all"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'exist'
    )

    // request access and make sure that it shows up as requested
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(restrictedName)
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      restrictedDescription
    )
    cy.get('[data-cy="import-modal-cancel"]').click()
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).contains(
      messages.manage.resources.requestedAccess
    )
  })

  function requestAccessPro2() {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'exist'
    )

    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(restrictedName)
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      restrictedDescription
    )
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessRESTRICTED)
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).contains(
      messages.manage.resources.requestedAccess
    )

    // content should not be accessible
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').should('not.exist')
  }

  it('Request access to the restricted answer collection for user pro2', () => {
    requestAccessPro2()
  })

  it('Cancel request to the restricted answer collection for user pro2', () => {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="confirm-cancel-sharing-request"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should(
      'not.exist'
    )
  })

  it('Request access to the restricted answer collection again (pro2)', () => {
    requestAccessPro2()
  })

  it('Approve (pro1) and deny (pro2) the access requests to the restricted answer collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()

    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('exist')
    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('exist')

    cy.get(
      `[data-cy="approve-sharing-request-${restrictedName}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).click()
    cy.get(
      `[data-cy="deny-sharing-request-${restrictedName}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).click()

    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
    cy.reload()
    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_IND_SHORTNAME')}"]`
    ).should('not.exist')
    cy.get(
      `[data-cy="sharing-request-${restrictedName}-${Cypress.env('LECTURER_INST_SHORTNAME')}"]`
    ).should('not.exist')
  })

  it('Verify that user pro1 has access to the restricted answer collection', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should('exist')
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()

    // check that the entire content is visible
    cy.get('[data-cy="viewing-collection-title"]').contains(restrictedName)
    cy.get('[data-cy="viewing-collection-description"]').contains(
      restrictedDescription
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    restrictedItems
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
  })

  it('Verify that only the shared and restricted answer collection is available during question creation for user pro1', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(`[data-cy="select-answer-collection-${publicName}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="select-answer-collection-${restrictedName}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="select-answer-collection-${privateNameNew}"]`).should(
      'not.exist'
    )
  })

  it('Verify that user pro2 does not have access to the restricted answer collection', () => {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should(
      'not.exist'
    )
  })

  it('Verify that no answer collection is available for user pro2', () => {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Import the public answer collection for user pro1 and verify access to it', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // import answer collection
    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).click()
    cy.get('[data-cy="import-modal-collection-name"]').contains(publicName)
    cy.get('[data-cy="import-modal-collection-description"]').contains(
      publicDescription
    )
    cy.get('[data-cy="public-collection-show-answers"]').click()
    publicItemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="public-collection-answer-option-${ix}"]`).contains(
          value
        )
      })
    cy.get('[data-cy="import-modal-cancel"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).click()
    cy.get('[data-cy="import-modal-confirm"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`)
      .should('exist')
      .contains(messages.manage.resources.accessPUBLIC)
    cy.get(`[data-cy="answer-collection-${publicName}"]`).contains(
      messages.manage.resources.viewCollection
    )
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should(
      'not.exist'
    )

    // check that the imported collection is visible
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(publicName)
    cy.get('[data-cy="viewing-collection-description"]').contains(
      publicDescription
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    publicItemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()
  })

  it('Verify that imported public answer collection is also available for during question creation user pro1', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(`[data-cy="select-answer-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="select-answer-collection-${restrictedName}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="select-answer-collection-${privateNameNew}"]`).should(
      'not.exist'
    )
  })

  it('Login again as user pro1 and verify that the answer collections are still visible', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    // verify that restricted collection is accessbile
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should('exist')
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).contains(
      Cypress.env('LECTURER_SHORTNAME')
    )
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(restrictedName)
    cy.get('[data-cy="viewing-collection-description"]').contains(
      restrictedDescription
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    restrictedItems
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()

    // verify that public collection is still visible
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="viewing-collection-title"]').contains(publicName)
    cy.get('[data-cy="viewing-collection-description"]').contains(
      publicDescription
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessPUBLIC
    )
    publicItemsAfterDeletion
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
    cy.get('[data-cy="close-viewing-collection-modal"]').click()
  })
  // #endregion

  // ! Answer Collection Deletion Workflows
  // #region
  it('Request access to the restricted answer collection for user pro2', () => {
    requestAccessPro2()
  })

  it('Verify that shared restricted and public collections can be soft deleted, soft delete restricted collection', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    // soft delete restricted collection
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
  })

  it('Verify that the restricted and shared collection can still be accessed', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should('exist')
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).contains(
      messages.shared.generic.unknown
    )
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()

    // check that the entire content is visible
    cy.get('[data-cy="viewing-collection-title"]').contains(restrictedName)
    cy.get('[data-cy="viewing-collection-description"]').contains(
      restrictedDescription
    )
    cy.get('[data-cy="viewing-collection-access"]').contains(
      messages.manage.resources.accessRESTRICTED
    )
    restrictedItems
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach((value, ix) => {
        cy.get(`[data-cy="viewing-collection-answer-${ix}"]`).contains(value)
      })
  })

  it('Verify that requested collections are automatically declined on soft deletion', () => {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should(
      'not.exist'
    )
  })

  it('Verify that the restricted collection cannot be requested anymore', () => {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="resources"]').click()

    cy.get('[data-cy="add-shared-answer-collection"]').click()
    cy.get(`[data-cy="import-list-collection-${publicName}"]`).should('exist')
    cy.get(`[data-cy="import-list-collection-${restrictedName}"]`).should(
      'not.exist'
    )
  })

  it('Add a question to the shared public answer collection', () => {
    cy.loginLecturer()
    cy.createQuestionSE({
      title: SEQuestionTitle,
      content:
        'This question fulfills its purpose by blocking the deletion of the public answer collection',
      numberOfInputs: 2,
      collectionName: publicName,
    })
  })

  it('Verify that the shared answer collection cannot be deleted due to the linked question', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('be.disabled')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('After deletion of the question, the shared answer collection can be removed and is deleted', () => {
    cy.loginLecturer()
    cy.get(`[data-cy="delete-question-${SEQuestionTitle}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${SEQuestionTitle}"]`).should('not.exist')

    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').should('not.be.disabled')
  })

  it('Cleanup: Remove all remaining answer collections from user pro1 (restricted and public)', () => {
    cy.loginIndividualCatalyst()
    cy.get('[data-cy="resources"]').click()

    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).should('not.exist')

    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
    cy.get('[data-cy="remove-answer-collection"]').click()
    cy.get('[data-cy="confirm-remove-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Verify that no answer collection is available for user pro2', () => {
    cy.loginInstitutionalCatalyst()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Cleanup: Verify that no answer collection is available for user pro3', () => {
    cy.loginInstitutionalCatalyst2()
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.SELECTION.typeLabel}"]`
    ).click()

    cy.get('[data-cy="select-answer-collection"]').should('not.exist')
    cy.findByText(messages.manage.questionForms.SEAnswerCollectionRequired)
  })

  it('Cleanup: Delete all remaining answer collections (public and private)', () => {
    cy.loginLecturer()
    cy.get('[data-cy="resources"]').click()
    cy.get(`[data-cy="answer-collection-${restrictedName}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${privateNameNew}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${privateNameNew}"]`).should(
      'not.exist'
    )

    cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
    cy.get('[data-cy="delete-answer-collection"]').click()
    cy.get('[data-cy="confirm-delete-answer-collection"]').click()
    cy.get(`[data-cy="answer-collection-${publicName}"]`).should('not.exist')
  })
  // #endregion

  // ! Access rule modifications and automatic accepts
  // TODO: create separate test cases where we create a restricted and public collection, add a user to both, request access to restricted for another user
  // TODO check that both cannot be changed to lower level access, change state to public for restricted one and observe that user automatically gets access
  // TODO: clenup - remove from two new users and delete collections
  // it('Verify that the public answer collection cannot be switched back to private or restricted anymore once other users use it', () => {
  //   cy.loginLecturer()
  //   cy.get('[data-cy="resources"]').click()
  //   cy.get(`[data-cy="answer-collection-${publicName}"]`).click()
  //   cy.get('[data-cy="answer-collection-access"]').contains(
  //     messages.manage.resources.accessPUBLIC
  //   )
  //   cy.get('[data-cy="answer-collection-access"]').click()
  //   cy.get('[data-cy="answer-collection-access-restricted"]').should(
  //     'have.css',
  //     'pointer-events',
  //     'none'
  //   )
  //   cy.get('[data-cy="answer-collection-access-private"]').should(
  //     'have.css',
  //     'pointer-events',
  //     'none'
  //   )
  //   cy.get('[data-cy="answer-collection-access-public"]').click()
  // })

  // it('Verify that the restricted answer collection cannot be switched to private once other users use it', () => {
  //   cy.loginLecturer()
  //   cy.get('[data-cy="resources"]').click()
  //   cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
  //   cy.get('[data-cy="answer-collection-access"]').contains(
  //     messages.manage.resources.accessRESTRICTED
  //   )
  //   cy.get('[data-cy="answer-collection-access"]').click()
  //   cy.get('[data-cy="answer-collection-access-private"]').should(
  //     'have.css',
  //     'pointer-events',
  //     'none'
  //   )
  //   cy.get('[data-cy="answer-collection-access-public"]').click()
  //   cy.get('[data-cy="answer-collection-access"]').contains(
  //     messages.manage.resources.accessPUBLIC
  //   )
  //   cy.get('[data-cy="save-changes-answer-collection"]').click()

  //   cy.reload()
  //   cy.get(`[data-cy="answer-collection-${restrictedName}"]`).click()
  //   cy.get('[data-cy="answer-collection-access"]').contains(
  //     messages.manage.resources.accessPUBLIC
  //   )
  //   cy.get('[data-cy="answer-collection-access"]').click()
  //   cy.get('[data-cy="answer-collection-access-restricted"]').should(
  //     'have.css',
  //     'pointer-events',
  //     'none'
  //   )
  //   cy.get('[data-cy="answer-collection-access-private"]').should(
  //     'have.css',
  //     'pointer-events',
  //     'none'
  //   )
  //   cy.get('[data-cy="answer-collection-access-public"]').click()
  // })
})
