import { v4 as uuid } from 'uuid'
import messages from '../../../packages/i18n/messages/en'

const CTTitle = 'Content Title'
const CTContent = 'Content Text'
const CTTitleEdited = 'Content Title Edited'
const CTContentEdited = 'Content Text Edited'

const FCTitle = 'Flashcard Title'
const FCContent = 'Flashcard Text'
const FCExplanation = 'Flashcard Explanation'
const FCTitleEdited = 'Flashcard Title Edited'
const FCContentEdited = 'Flashcard Text Edited'
const FCExplanationEdited = 'Flashcard Explanation Edited'

const SCTitle = 'Single Choice Title'
const SCContent = 'Single Choice Text'
const SCChoices = ['50%', '100%']
const SCTitleEdited = 'Single Choice Title Edited'
const SCContentEdited = 'Single Choice Text Edited'
const SCChoicesEdited = ['25%', '50%', '100%']

const MCTitle = 'Multiple Choice Title'
const MCContent = 'Multiple Choice Text'
const MCChoices = ['25%', '50%', '75%', '100%']
const MCTitleEdited = 'Multiple Choice Title Edited'
const MCContentEdited = 'Multiple Choice Text Edited'
const MCChoicesEdited = ['10%', '20%', '30%', '40%', '50%', '60%', '70%']

const KPRIMTitle = 'KPRIM Title'
const KPRIMContent = 'KPRIM Text'
const KPRIMChoices = ['25%', '50%', '75%', '100%']
const KPRIMTitleEdited = 'KPRIM Title Edited'
const KPRIMContentEdited = 'KPRIM Text Edited'
const KPRIMChoicesEdited = ['10%', '20%', '30%', '40%']

const NRTitle = 'Numerical Range Title'
const NRContent = 'Numerical Range Text'
const NRMin = 0
const NRMax = 100
const NRAccuracy = 0
const NRUnit = '%'
const NRTitleEdited = 'Numerical Range Title Edited'
const NRContentEdited = 'Numerical Range Text Edited'
const NRMinEdited = -200
const NRMaxEdited = 50
const NRAccuracyEdited = 2
const NRUnitEdited = 'kg'
const NRSolutionRanges = [
  { min: 40, max: undefined },
  { min: -50, max: 20 },
  { min: undefined, max: -80 },
]
const NRSolutionsExact = [-10, 10, 50]

const FTTitle = 'Free Text Question Title'
const FTContent = 'Free Text Question Text'
const FTMaxLength = 100
const FTTitleEdited = 'Free Text Question Title Edited'
const FTContentEdited = 'Free Text Question Text Edited'
const FTMaxLengthEdited = 300
const FTSampleSolution = [
  'Sample Solution 1',
  'Sample Solution 2',
  'Sample Solution 3',
]

describe('Create different types of elements (with and without sample solution) and edit them', () => {
  beforeEach(() => {
    cy.loginLecturer()
  })

  it('Create a content element', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CONTENT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(CTTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(CTContent)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${CTTitle}"]`).contains(CTContent)
    cy.get(`[data-cy="element-item-${CTTitle}"]`).contains(CTTitle)
    cy.get(`[data-cy="element-item-${CTTitle}"]`).contains(
      messages.shared.DRAFT.statusLabel
    )
  })

  it('Check that values of content element are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${CTTitle}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CONTENT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should('have.value', CTTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.DRAFT.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(CTContent)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a content element', () => {
    cy.get(`[data-cy="edit-question-${CTTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').clear().type(CTTitleEdited)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(CTContentEdited)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${CTTitleEdited}"]`).contains(
      CTContentEdited
    )
    cy.get(`[data-cy="element-item-${CTTitleEdited}"]`).contains(CTTitleEdited)
    cy.get(`[data-cy="element-item-${CTTitleEdited}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that edited content element is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${CTTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      CTTitleEdited
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(CTContentEdited)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a flashcard element', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FLASHCARD.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').type(FCTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.REVIEW.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(FCContent)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(FCExplanation)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${FCTitle}"]`).contains(FCContent)
    cy.get(`[data-cy="element-item-${FCTitle}"]`).contains(FCTitle)
    cy.get(`[data-cy="element-item-${FCTitle}"]`).contains(
      messages.shared.REVIEW.statusLabel
    )
  })

  it('Check that values of flashcard element are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${FCTitle}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FLASHCARD.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should('have.value', FCTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.REVIEW.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(FCContent)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(FCExplanation)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a flashcard element', () => {
    cy.get(`[data-cy="edit-question-${FCTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').clear().type(FCTitleEdited)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(FCContentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .type(FCExplanationEdited)
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${FCTitleEdited}"]`).contains(
      FCContentEdited
    )
    cy.get(`[data-cy="element-item-${FCTitleEdited}"]`).contains(FCTitleEdited)
    cy.get(`[data-cy="element-item-${FCTitleEdited}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that edited flashcard element is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${FCTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      FCTitleEdited
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(FCContentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .contains(FCExplanationEdited)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a single choice question', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(SCTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(SCContent)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type(SCChoices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(SCChoices[0])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type(SCChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(SCChoices[1])
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(SCChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(SCChoices[0])

    cy.get('[data-cy="move-answer-option-ix-1-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-1-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(SCChoices[0])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(SCChoices[1])
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${SCTitle}"]`).contains(SCContent)
    cy.get(`[data-cy="element-item-${SCTitle}"]`).contains(SCTitle)
    cy.get(`[data-cy="element-item-${SCTitle}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Check that values of single choice question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${SCTitle}"]`).click()
    cy.get('[data-cy="sc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="sc-1-answer-option-2"]').should('exist')

    cy.get('[data-cy="insert-question-title"]').should('have.value', SCTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(SCContent)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(SCChoices[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(SCChoices[1])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a single choice question and add a sample solution', () => {
    cy.get(`[data-cy="edit-question-${SCTitle}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]').clear().type(SCTitleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(SCContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(SCChoicesEdited[0])
    cy.get('[data-cy="delete-answer-option-ix-1"]').click()
    cy.get('[data-cy="insert-answer-field-1"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(SCChoicesEdited[1])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(SCChoicesEdited[2])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // only one correct answer is allowed
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${SCTitleEdited}"]`).contains(SCTitleEdited)
    cy.get(`[data-cy="element-item-${SCTitleEdited}"]`).contains(
      SCContentEdited
    )
  })

  it('Check that edited single choice question is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${SCTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      SCTitleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(SCContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(SCChoicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(SCChoicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(SCChoicesEdited[2])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a multiple choice question', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.MC.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.MC.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(MCTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(MCContent)
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type(MCChoices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(MCChoices[0])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type(MCChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(MCChoices[1])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]').realClick().type(MCChoices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(MCChoices[2])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]').realClick().type(MCChoices[3])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(MCChoices[3])
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(MCChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(MCChoices[0])

    cy.get('[data-cy="move-answer-option-ix-1-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-3-up"]').should('not.be.disabled')
    cy.get('[data-cy="move-answer-option-ix-3-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(MCChoices[0])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(MCChoices[1])
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.get(`[data-cy="element-item-${MCTitle}"]`).contains(MCContent)
    cy.get(`[data-cy="element-item-${MCTitle}"]`).contains(MCTitle)
    cy.get(`[data-cy="element-item-${MCTitle}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${MCTitle}"]`).click()
    cy.get('[data-cy="mc-1-answer-option-1"]').should('exist')
    cy.get('[data-cy="mc-1-answer-option-2"]').should('exist')
  })

  it('Check that values of multiple choice question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${MCTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', MCTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(MCContent)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(MCChoices[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(MCChoices[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(MCChoices[2])
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .contains(MCChoices[3])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a multiple choice question and add a sample solution', () => {
    cy.get(`[data-cy="edit-question-${MCTitle}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]').clear().type(MCTitleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(MCContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[2])
    cy.get('[data-cy="delete-answer-option-ix-3"]').click()
    cy.get('[data-cy="insert-answer-field-3"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[3])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-4"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[4])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-5"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[5])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-6"]')
      .realClick()
      .clear()
      .type(MCChoicesEdited[6])
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get(`[data-cy="set-correctness-5"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${MCTitleEdited}"]`).contains(MCTitleEdited)
    cy.get(`[data-cy="element-item-${MCTitleEdited}"]`).contains(
      MCContentEdited
    )
  })

  it('Check that edited multiple choice question is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${MCTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      MCTitleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(MCContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(MCChoicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(MCChoicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(MCChoicesEdited[2])
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .contains(MCChoicesEdited[3])
    cy.get('[data-cy="insert-answer-field-4"]')
      .realClick()
      .contains(MCChoicesEdited[4])
    cy.get('[data-cy="insert-answer-field-5"]')
      .realClick()
      .contains(MCChoicesEdited[5])
    cy.get('[data-cy="insert-answer-field-6"]')
      .realClick()
      .contains(MCChoicesEdited[6])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a KPRIM question', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.KPRIM.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(KPRIMTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(KPRIMContent)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .type(KPRIMChoices[0])
    cy.get('[data-cy="insert-answer-field-0"]').findByText(KPRIMChoices[0])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .type(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(KPRIMChoices[1])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .type(KPRIMChoices[2])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(KPRIMChoices[2])
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .type(KPRIMChoices[3])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(KPRIMChoices[3])
    cy.get('[data-cy="insert-question-title"]').click() // remove editor focus

    cy.get('[data-cy="move-answer-option-ix-0-up"]').should('be.disabled')
    cy.get('[data-cy="move-answer-option-ix-0-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(KPRIMChoices[0])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(KPRIMChoices[2])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(KPRIMChoices[3])

    cy.get('[data-cy="move-answer-option-ix-3-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="move-answer-option-ix-3-down"]').should('be.disabled')
    cy.get('[data-cy="insert-answer-field-0"]').findByText(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(KPRIMChoices[0])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(KPRIMChoices[3])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(KPRIMChoices[2])

    cy.get('[data-cy="move-answer-option-ix-2-up"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(KPRIMChoices[3])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(KPRIMChoices[0])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(KPRIMChoices[2])

    cy.get('[data-cy="move-answer-option-ix-2-down"]')
      .should('not.be.disabled')
      .click()
    cy.get('[data-cy="insert-answer-field-0"]').findByText(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]').findByText(KPRIMChoices[3])
    cy.get('[data-cy="insert-answer-field-2"]').findByText(KPRIMChoices[2])
    cy.get('[data-cy="insert-answer-field-3"]').findByText(KPRIMChoices[0])
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.get(`[data-cy="element-item-${KPRIMTitle}"]`).contains(KPRIMContent)
    cy.get(`[data-cy="element-item-${KPRIMTitle}"]`).contains(KPRIMTitle)
    cy.get(`[data-cy="element-item-${KPRIMTitle}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${KPRIMTitle}"]`).click()
    cy.get('[data-cy="kp-answer-options"]').should('have.length', 4)
  })

  it('Check that values of KPRIM question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${KPRIMTitle}"]`).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.KPRIM.typeLabel)
    cy.get('[data-cy="insert-question-title"]').should('have.value', KPRIMTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(KPRIMContent)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(KPRIMChoices[1])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(KPRIMChoices[3])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(KPRIMChoices[2])
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .contains(KPRIMChoices[0])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a KPRIM question and add a sample solution', () => {
    cy.get(`[data-cy="edit-question-${KPRIMTitle}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]').clear().type(KPRIMTitleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(KPRIMContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .clear()
      .type(KPRIMChoicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .clear()
      .type(KPRIMChoicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .clear()
      .type(KPRIMChoicesEdited[2])
    cy.get('[data-cy="delete-answer-option-ix-3"]').click()
    cy.get('[data-cy="insert-answer-field-3"]').should('not.exist')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .clear()
      .type(KPRIMChoicesEdited[3])
    cy.get('[data-cy="add-new-answer"]').should('be.disabled')
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled') // no correct solution required for KPRIM questions
    cy.get(`[data-cy="set-correctness-0"]`).click()
    cy.get(`[data-cy="set-correctness-2"]`).click()
    cy.get(`[data-cy="set-correctness-3"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${KPRIMTitleEdited}"]`).contains(
      KPRIMTitleEdited
    )
    cy.get(`[data-cy="element-item-${KPRIMTitleEdited}"]`).contains(
      KPRIMContentEdited
    )
  })

  it('Check that edited KPRIM question is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${KPRIMTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      KPRIMTitleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(KPRIMContentEdited)
    cy.get('[data-cy="insert-answer-field-0"]')
      .realClick()
      .contains(KPRIMChoicesEdited[0])
    cy.get('[data-cy="insert-answer-field-1"]')
      .realClick()
      .contains(KPRIMChoicesEdited[1])
    cy.get('[data-cy="insert-answer-field-2"]')
      .realClick()
      .contains(KPRIMChoicesEdited[2])
    cy.get('[data-cy="insert-answer-field-3"]')
      .realClick()
      .contains(KPRIMChoicesEdited[3])
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a Numerical question', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.NUMERICAL.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.NUMERICAL.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(NRTitle)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(NRContent)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="set-numerical-minimum"]').click().type(String(NRMin))
    cy.get('[data-cy="set-numerical-maximum"]').click().type(String(NRMax))
    cy.get('[data-cy="set-numerical-unit"]').click().type(NRUnit)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .type(String(NRAccuracy))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${NRTitle}"]`).contains(NRContent)
    cy.get(`[data-cy="element-item-${NRTitle}"]`).contains(NRTitle)
    cy.get(`[data-cy="element-item-${NRTitle}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-question-${NRTitle}"]`).click()
    cy.get('[data-cy="input-numerical-minimum"]').contains(`Min: ${NRMin}`)
    cy.get('[data-cy="input-numerical-maximum"]').contains(`Max: ${NRMax}`)
    cy.get('[data-cy="input-numerical-accuracy"]').contains(
      `Precision: ${NRAccuracy}`
    )
    cy.get('[data-cy="input-numerical-unit"]').contains(NRUnit)
  })

  it('Check that values of Numerical question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${NRTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', NRTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(NRContent)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(NRMin)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(NRMax)
    )
    cy.get('[data-cy="set-numerical-unit"]').should('have.value', NRUnit)
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(NRAccuracy)
    )
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a Numerical question and add a sample solution', () => {
    cy.get(`[data-cy="edit-question-${NRTitle}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]').clear().type(NRTitleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(NRContentEdited)
    cy.get('[data-cy="set-numerical-minimum"]')
      .click()
      .clear()
      .type(String(NRMinEdited))
    cy.get('[data-cy="set-numerical-maximum"]')
      .click()
      .clear()
      .type(String(NRMaxEdited))
    cy.get('[data-cy="set-numerical-unit"]').click().clear().type(NRUnitEdited)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .clear()
      .type(String(NRAccuracyEdited))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required

    cy.get('[data-cy="set-solution-type-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required
    NRSolutionRanges.forEach((range, ix) => {
      cy.get('[data-cy="add-solution-range"]').click()
      if (typeof range.min !== 'undefined') {
        cy.get(`[data-cy="set-solution-range-min-${ix}"]`)
          .click()
          .type(String(range.min))
      }
      if (typeof range.max !== 'undefined') {
        cy.get(`[data-cy="set-solution-range-max-${ix}"]`)
          .click()
          .type(String(range.max))
      }
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })

    // solution ranges with min below restrictions min or max above restrictions max are not allowed
    const newIx = NRSolutionRanges.length
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .type(String(NRMinEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .clear()
      .type(String(NRMinEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .type(String(NRMaxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .clear()
      .type(String(NRMaxEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
    cy.get(`[data-cy="element-item-${NRTitleEdited}"]`).contains(NRTitleEdited)
    cy.get(`[data-cy="element-item-${NRTitleEdited}"]`).contains(
      NRContentEdited
    )
  })

  it('Check that edited Numerical question is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${NRTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      NRTitleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(NRContentEdited)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(NRMinEdited)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(NRMaxEdited)
    )
    cy.get('[data-cy="set-numerical-unit"]').should('have.value', NRUnitEdited)
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(NRAccuracyEdited)
    )

    NRSolutionRanges.forEach((range, ix) => {
      if (typeof range.min !== 'undefined') {
        cy.get(`[data-cy="set-solution-range-min-${ix}"]`).should(
          'have.value',
          String(range.min)
        )
      }
      if (typeof range.max !== 'undefined') {
        cy.get(`[data-cy="set-solution-range-max-${ix}"]`).should(
          'have.value',
          String(range.max)
        )
      }
    })

    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit the numerical question again and set an exact solution', () => {
    cy.get(`[data-cy="edit-question-${NRTitleEdited}"]`).click()
    cy.get('[data-cy="set-solution-type-exact"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required

    NRSolutionsExact.forEach((solution, ix) => {
      cy.get(`[data-cy="add-exact-solution"]`).click()
      cy.get(`[data-cy="set-exact-solution-${ix}"]`)
        .click()
        .type(String(solution))
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })

    // exact solutions outside of the restrictions are not allowed
    const newIx = NRSolutionsExact.length
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(NRMinEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(NRMaxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Verify that the exact solutions of the numerical question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${NRTitleEdited}"]`).click()
    NRSolutionsExact.forEach((solution, ix) => {
      cy.get(`[data-cy="set-exact-solution-${ix}"]`).should(
        'have.value',
        String(solution)
      )
    })
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a Free Text question', () => {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.FREE_TEXT.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.FREE_TEXT.typeLabel)
    cy.get('[data-cy="insert-question-title"]').click().type(FTTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(FTContent)
    cy.get('[data-cy="set-free-text-length"]').click().type(String(FTMaxLength))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    cy.get(`[data-cy="element-item-${FTTitle}"]`).contains(FTContent)
    cy.get(`[data-cy="element-item-${FTTitle}"]`).contains(FTTitle)
    cy.get(`[data-cy="element-item-${FTTitle}"]`).contains(
      messages.shared.READY.statusLabel
    )

    cy.get(`[data-cy="edit-question-${FTTitle}"]`).click()
    cy.get('[data-cy="free-text-input-1"]').should('exist')
  })

  it('Check that values of Free Text question are stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${FTTitle}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should('have.value', FTTitle)
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]').realClick().contains(FTContent)
    cy.get('[data-cy="set-free-text-length"]').should('have.value', FTMaxLength)
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Edit a Free Text question', () => {
    cy.get(`[data-cy="edit-question-${FTTitle}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]').clear().type(FTTitleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(FTContentEdited)
    cy.get('[data-cy="set-free-text-length"]')
      .click()
      .clear()
      .type(String(FTMaxLengthEdited))

    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required
    FTSampleSolution.forEach((solution, ix) => {
      cy.get(`[data-cy="add-solution-value"]`).click()
      cy.get(`[data-cy="set-solution-ix-${ix}"]`).click().type(solution)
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${FTTitleEdited}"]`).contains(
      FTContentEdited
    )
    cy.get(`[data-cy="element-item-${FTTitleEdited}"]`).contains(FTTitleEdited)
  })

  it('Check that edited Free Text question is stored and loaded correctly', () => {
    cy.get(`[data-cy="edit-question-${FTTitleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      FTTitleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(FTContentEdited)
    cy.get('[data-cy="set-free-text-length"]').should(
      'have.value',
      FTMaxLengthEdited
    )
    FTSampleSolution.forEach((solution, ix) => {
      cy.get(`[data-cy="set-solution-ix-${ix}"]`).should('have.value', solution)
    })
    cy.get('[data-cy="close-question-modal"]').click()
  })

  it('Create a new question, duplicates it and then deletes the duplicate again', () => {
    const randomNumber = uuid()
    const questionTitle = 'A Single Choice ' + randomNumber
    const question = 'Was ist die Wahrscheinlichkeit? ' + randomNumber

    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="insert-question-title"]').type(questionTitle)
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.DRAFT.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]').realClick().type(question)
    cy.get('[data-cy="insert-answer-field-0"]').realClick().type('50%')
    cy.get('[data-cy="add-new-answer"]').click()
    cy.wait(500)
    cy.get('[data-cy="insert-answer-field-1"]').realClick().type('100%')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // duplicate question and save
    cy.get(`[data-cy="duplicate-question-${questionTitle}"]`).click()
    cy.wait(500)
    cy.findByText(messages.manage.questionForms.DUPLICATETitle).should('exist')
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(500)

    // check if duplicated question exists alongside original question
    cy.get(`[data-cy="element-item-${questionTitle}"]`).should('exist')
    cy.get(`[data-cy="element-item-${questionTitle + ' (Copy)'}"]`).should(
      'exist'
    )
    cy.get(`[data-cy="element-item-${questionTitle + ' (Copy)'}"]`).contains(
      messages.shared.DRAFT.statusLabel
    )

    // delete the duplicated question
    cy.get(`[data-cy="delete-question-${questionTitle} (Copy)"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${questionTitle}"]`).should('exist')
    cy.get(`[data-cy="element-item-${questionTitle + ' (Copy)'}"]`).should(
      'not.exist'
    )
  })

  it('Cleanup: Delete all created questions', () => {
    cy.get(`[data-cy="delete-question-${CTTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${CTTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${FCTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${FCTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${SCTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${SCTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${MCTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${MCTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${KPRIMTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${KPRIMTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${NRTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${NRTitleEdited}"]`).should('not.exist')

    cy.get(`[data-cy="delete-question-${FTTitleEdited}"]`).click()
    cy.get('[data-cy="confirm-question-deletion"]').click()
    cy.get(`[data-cy="element-item-${FTTitleEdited}"]`).should('not.exist')
  })
})
