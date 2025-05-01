import messages from '../../../packages/i18n/messages/en'

describe('Test creation and editing functionalities, validation, etc. for numerical elements', function () {
  before(() => {
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Login the lecturer and load data fixture', function () {
    cy.loginLecturer()
    cy.fixture('DM-questions.json').then((data) => {
      this.data = data
    })
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Numerical questions
  // #region
  it('Create a Numerical question', function () {
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
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.NR.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.NR.content)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="set-numerical-minimum"]')
      .click()
      .type(String(this.data.NR.min))
    cy.get('[data-cy="set-numerical-maximum"]')
      .click()
      .type(String(this.data.NR.max))
    cy.get('[data-cy="set-numerical-unit"]').click().type(this.data.NR.unit)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .type(String(this.data.NR.accuracy))
    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)

    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      this.data.NR.content
    )
    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      this.data.NR.title
    )
    cy.get(`[data-cy="element-item-${this.data.NR.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
    cy.get(`[data-cy="edit-element-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="input-numerical-minimum"]').contains(
      `Min: ${this.data.NR.min}`
    )
    cy.get('[data-cy="input-numerical-maximum"]').contains(
      `Max: ${this.data.NR.max}`
    )
    cy.get('[data-cy="input-numerical-accuracy"]').contains(
      `Precision: ${this.data.NR.accuracy}`
    )
    cy.get('[data-cy="input-numerical-unit"]').contains(this.data.NR.unit)
  })

  it('Check that values of Numerical question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.NR.title
    )
    cy.get('[data-cy="select-question-status"]')
      .should('exist')
      .contains(messages.shared.READY.statusLabel)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.NR.content)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(this.data.NR.min)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(this.data.NR.max)
    )
    cy.get('[data-cy="set-numerical-unit"]').should(
      'have.value',
      this.data.NR.unit
    )
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(this.data.NR.accuracy)
    )
    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit a Numerical question and add a sample solution', function () {
    cy.get(`[data-cy="edit-element-${this.data.NR.title}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.NR.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.NR.contentEdited)
    cy.get('[data-cy="set-numerical-minimum"]')
      .click()
      .clear()
      .type(String(this.data.NR.minEdited))
    cy.get('[data-cy="set-numerical-maximum"]')
      .click()
      .clear()
      .type(String(this.data.NR.maxEdited))
    cy.get('[data-cy="set-numerical-unit"]')
      .click()
      .clear()
      .type(this.data.NR.unitEdited)
    cy.get('[data-cy="set-numerical-accuracy"]')
      .click()
      .clear()
      .type(String(this.data.NR.accuracyEdited))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click({ force: true })
    cy.wait(500)
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required

    cy.get('[data-cy="set-solution-type-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // selection of sample solution type required
    cy.wrap(this.data.NR.solutionRanges).each(
      (range: { min: number | null; max: number | null }, ix) => {
        cy.get('[data-cy="add-solution-range"]').click()
        if (range.min !== null) {
          cy.get(`[data-cy="set-solution-range-min-${ix}"]`)
            .click()
            .type(String(range.min))
        }
        if (range.max !== null) {
          cy.get(`[data-cy="set-solution-range-max-${ix}"]`)
            .click()
            .type(String(range.max))
        }
        cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
      }
    )

    // solution ranges with min below restrictions min or max above restrictions max are not allowed
    const newIx = this.data.NR.solutionRanges.length
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .type(String(this.data.NR.minEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-min-${newIx}"]`)
      .click()
      .clear()
      .type(String(this.data.NR.minEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()
    cy.get('[data-cy="add-solution-range"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // min or max required
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .type(String(this.data.NR.maxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="set-solution-range-max-${newIx}"]`)
      .click()
      .clear()
      .type(String(this.data.NR.maxEdited))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="delete-solution-range-ix-${newIx}"]`).click()

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
    cy.get(`[data-cy="element-item-${this.data.NR.titleEdited}"]`).contains(
      this.data.NR.titleEdited
    )
    cy.get(`[data-cy="element-item-${this.data.NR.titleEdited}"]`).contains(
      this.data.NR.contentEdited
    )
  })

  it('Check that edited Numerical question is stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.NR.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.NR.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.NR.contentEdited)
    cy.get('[data-cy="set-numerical-minimum"]').should(
      'have.value',
      String(this.data.NR.minEdited)
    )
    cy.get('[data-cy="set-numerical-maximum"]').should(
      'have.value',
      String(this.data.NR.maxEdited)
    )
    cy.get('[data-cy="set-numerical-unit"]').should(
      'have.value',
      this.data.NR.unitEdited
    )
    cy.get('[data-cy="set-numerical-accuracy"]').should(
      'have.value',
      String(this.data.NR.accuracyEdited)
    )

    cy.wrap(this.data.NR.solutionRanges).each(
      (range: { min: number | null; max: number | null }, ix) => {
        if (range.min !== null) {
          cy.get(`[data-cy="set-solution-range-min-${ix}"]`).should(
            'have.value',
            String(range.min)
          )
        }
        if (range.max !== null) {
          cy.get(`[data-cy="set-solution-range-max-${ix}"]`).should(
            'have.value',
            String(range.max)
          )
        }
      }
    )

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Edit the numerical question again and set an exact solution', function () {
    cy.get(`[data-cy="edit-element-${this.data.NR.titleEdited}"]`).click()
    cy.get('[data-cy="set-solution-type-exact"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // at least one correct answer is required

    cy.wrap(this.data.NR.exactSolutions).each((solution: number, ix) => {
      cy.get(`[data-cy="add-exact-solution"]`).click()
      cy.get(`[data-cy="set-exact-solution-${ix}"]`)
        .click()
        .type(String(solution))
      cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    })

    // exact solutions outside of the restrictions are not allowed
    const newIx = this.data.NR.exactSolutions.length
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(this.data.NR.minEdited - 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get(`[data-cy="add-exact-solution"]`).click()
    cy.get(`[data-cy="set-exact-solution-${newIx}"]`)
      .click()
      .type(String(this.data.NR.maxEdited + 10))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get(`[data-cy="delete-exact-solution-${newIx}"]`).click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="save-new-question"]').click({ force: true })
    cy.wait(1000)
  })

  it('Verify that the exact solutions of the numerical question are stored and loaded correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.NR.titleEdited}"]`).click()
    cy.wrap(this.data.NR.exactSolutions).each((solution: number, ix) => {
      cy.get(`[data-cy="set-exact-solution-${ix}"]`).should(
        'have.value',
        String(solution)
      )
    })
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion
})
