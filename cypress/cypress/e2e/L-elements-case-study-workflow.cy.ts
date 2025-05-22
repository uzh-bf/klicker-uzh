import messages from '../../../packages/i18n/messages/en'

type CriterionDataType = {
  mode: 'range' | 'steps'
  name: string
  // range criterion attributes
  min?: number
  max?: number
  step?: number
  unit?: string
  // steps criterion attribute
  steps?: number
  labels?: {
    min: string
    mid?: string
    max: string
  }
}

describe('Test creation and editing functionalities, validation, etc. for case study elements', function () {
  before(() => {
    cy.seed()
  })

  after(() => {
    cy.cleanup()
  })

  beforeEach('Login the lecturer and load data fixture', function () {
    cy.fixture('DM-questions.json').then((data) => {
      this.data = data
    })

    cy.loginLecturer()
    cy.get('[data-cy="resources"]').should('exist')
    cy.get('[data-cy="analytics"]').should('exist')
  })

  // ! DEV: if a test case fails, stop the test run
  // afterEach(function () {
  //   if (this.currentTest.state === 'failed') {
  //     Cypress.stop()
  //   }
  // })

  // ! Case Study questions
  // #region
  it('Create the answer collection that will be used for the case study question tests', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get('[data-cy="answer-collection-list"]').should('exist')
    cy.createAnswerCollection({
      name: this.data.CS.collection,
      description: this.data.CS.collectionDescription,
      entries: [...this.data.CS.items, ...this.data.CS.unselectedItems],
      userId: Cypress.env('LECTURER_ID'),
    })
    cy.createAnswerCollection({
      name: this.data.CS.collectionEdited,
      description: this.data.CS.collectionDescriptionEdited,
      entries: [
        ...this.data.CS.itemsEdited,
        ...this.data.CS.unselectedItemsEdited,
      ],
      userId: Cypress.env('LECTURER_ID'),
    })
  })

  it('Create a Case Study question', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.SC.typeLabel)
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CASE_STUDY.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CASE_STUDY.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.CS.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CS.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.CS.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select an answer collection
    cy.get('[data-cy="select-answer-collection"]').contains(
      messages.manage.elements.selectCollection
    )
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collection
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // select items for case study
    cy.wrap(this.data.CS.items).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').click()
      cy.findByText(item).realClick()
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // add new criteria, and remove one again
    cy.wrap([...this.data.CS.criteria, this.data.CS.removedCriterion]).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="add-${criterion.mode}-criterion"]`).click()
        cy.get(`[data-cy="criterion-${ix}-name"]`)
          .click()
          .clear()
          .type(criterion.name)

        // for range criteria, enter min, max, and step - unit is optional
        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`)
            .click()
            .clear()
            .type(String(criterion.min))
          cy.get(`[data-cy="criterion-${ix}-max"]`)
            .click()
            .clear()
            .type(String(criterion.max))
          cy.get(`[data-cy="criterion-${ix}-step"]`)
            .click()
            .clear()
            .type(String(criterion.step))
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`)
              .click()
              .type(criterion.unit)
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.min))
          cy.get(`[data-cy="criterion-${ix}-max-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.max))
          cy.get(`[data-cy="criterion-${ix}-steps"]`)
            .click()
            .clear()
            .type(String(criterion.steps))

          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`)
              .click()
              .clear()
              .type(String(criterion.labels.mid))
          }
        } else {
          throw new Error('Invalid criterion mode')
        }

        // validate inputs
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`).should(
            'have.value',
            String(criterion.min)
          )
          cy.get(`[data-cy="criterion-${ix}-max"]`).should(
            'have.value',
            String(criterion.max)
          )
          cy.get(`[data-cy="criterion-${ix}-step"]`).should(
            'have.value',
            String(criterion.step)
          )
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
              'have.value',
              criterion.unit
            )
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`).should(
            'have.value',
            criterion.labels.min
          )
          cy.get(`[data-cy="criterion-${ix}-max-label"]`).should(
            'have.value',
            criterion.labels.max
          )
          cy.get(`[data-cy="criterion-${ix}-steps"]`).should(
            'have.value',
            String(criterion.steps)
          )
          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`).should(
              'have.value',
              criterion.labels.mid
            )
          }
        } else {
          throw new Error('Invalid criterion mode')
        }
      }
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    cy.wrap([...this.data.CS.cases, this.data.CS.removedCase]).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get('[data-cy="add-new-case"]').click()
        cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
        cy.get(`[data-cy="case-description-${ix}"]`)
          .realClick()
          .type(caseItem.description)

        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
        cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
      }
    )
    cy.get(`[data-cy="delete-case-${this.data.CS.cases.length}"]`).click()
    cy.get(`[data-cy="cancel-delete-case"]`).click()
    cy.get(`[data-cy="delete-case-${this.data.CS.cases.length}"]`).click()
    cy.get(`[data-cy="confirm-delete-case"]`).click()
    cy.get(`[data-cy="case-title-${this.data.CS.cases.length}"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="case-description-${this.data.CS.cases.length}"]`).should(
      'not.exist'
    )

    // test that enabling sample solution works correctly
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      this.data.CS.content
    )
    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      this.data.CS.title
    )
    cy.get(`[data-cy="element-item-${this.data.CS.title}"]`).contains(
      messages.shared.READY.statusLabel
    )
  })

  it('Verify that the correct content has been saved', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )
    cy.get('[data-cy="select-question-status"]').contains(
      messages.shared.READY.statusLabel
    )
    cy.get('[data-cy="insert-question-text"]').contains(this.data.CS.content)
    cy.get('[data-cy="insert-question-explanation"]').contains(
      this.data.CS.explanation
    )

    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collection
    )
    cy.wrap(this.data.CS.items).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    cy.wrap([...this.data.CS.criteria, this.data.CS.removedCriterion]).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`).should(
            'have.value',
            String(criterion.min)
          )
          cy.get(`[data-cy="criterion-${ix}-max"]`).should(
            'have.value',
            String(criterion.max)
          )
          cy.get(`[data-cy="criterion-${ix}-step"]`).should(
            'have.value',
            String(criterion.step)
          )
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
              'have.value',
              criterion.unit
            )
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`).should(
            'have.value',
            criterion.labels.min
          )
          cy.get(`[data-cy="criterion-${ix}-max-label"]`).should(
            'have.value',
            criterion.labels.max
          )
          cy.get(`[data-cy="criterion-${ix}-steps"]`).should(
            'have.value',
            String(criterion.steps)
          )
          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`).should(
              'have.value',
              criterion.labels.mid
            )
          }
        } else {
          throw new Error('Invalid criterion mode')
        }
      }
    )

    cy.wrap(this.data.CS.cases).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that creation was successful', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    cy.get('[data-cy="student-element-preview"]')
      .findByText(messages.shared.generic.instructions)
      .should('exist')
    cy.get('[data-cy="student-element-preview"]') // instructions should be visible in preview
      .findByText(this.data.CS.content)
      .should('exist')

    // check if case information is visible
    cy.get('[data-cy="case-0-title"]').contains(this.data.CS.cases[0].title)
    cy.get('[data-cy="case-0-description"]').contains(
      this.data.CS.cases[0].description
    )
    cy.get('[data-cy="case-1-title"]').contains(this.data.CS.cases[1].title)
    cy.get('[data-cy="case-1-description"]').contains(
      this.data.CS.cases[1].description
    )

    // check that sliders are initilized correctly and that values changes persist
    const steps = 78
    const midValue =
      this.data.CS.criteria[0].min +
      (this.data.CS.criteria[0].max - this.data.CS.criteria[0].min) / 2
    const slidedValue = midValue + steps * this.data.CS.criteria[0].step
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-0"]').contains(
      this.data.CS.criteria[0].unit ? `- ${this.data.CS.criteria[0].unit}` : '-'
    )
    cy.get('[data-cy="cs-slider-0-0-0-0"]')
      .click()
      .type('{rightarrow}{leftarrow}')
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-0"]').contains(
      this.data.CS.criteria[0].unit
        ? `${midValue} ${this.data.CS.criteria[0].unit}`
        : String(midValue)
    )
    cy.get('[data-cy="cs-slider-0-0-0-0"]')
      .click()
      .type('{rightarrow}'.repeat(steps))
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-0"]').contains(
      this.data.CS.criteria[0].unit
        ? `${slidedValue} ${this.data.CS.criteria[0].unit}`
        : String(slidedValue)
    )

    // check that moving a slider all the way to one end works to be expected
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-1"]').contains(
      this.data.CS.criteria[1].unit ? `- ${this.data.CS.criteria[1].unit}` : '-'
    )
    cy.get('[data-cy="cs-slider-0-0-0-1"]')
      .click()
      .type('{leftarrow}'.repeat(260))
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-1"]').contains(
      this.data.CS.criteria[1].unit
        ? `${this.data.CS.criteria[1].min} ${this.data.CS.criteria[1].unit}`
        : String(this.data.CS.criteria[1].min)
    )
    cy.get('[data-cy="cs-slider-0-0-0-1"]')
      .click()
      .type('{rightarrow}'.repeat(600))
    cy.get('[data-cy="cs-slider-nr-value-0-0-0-1"]').contains(
      this.data.CS.criteria[1].unit
        ? `${this.data.CS.criteria[1].max} ${this.data.CS.criteria[1].unit}`
        : String(this.data.CS.criteria[1].max)
    )

    // check that sliders are shown for all response items
    for (let caseIx = 0; caseIx < this.data.CS.cases.length; caseIx++) {
      for (
        let criterionIx = 0;
        criterionIx < this.data.CS.criteria.length;
        criterionIx++
      ) {
        for (let itemIx = 0; itemIx < this.data.CS.items.length; itemIx++) {
          cy.get(
            `[data-cy="cs-slider-nr-value-0-${caseIx}-${itemIx}-${criterionIx}"]`
          ).should('exist')
        }
      }
    }
  })

  it('Verify that the deletion of answer collection entries is limited, editing is unaffected', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Verify that the answer collection used in the case study can no longer be deleted', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.findByText(messages.manage.resources.answerOptionUsed).should('exist')
  })

  it('Add a sample solution to the case study question', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // correct answers for all criteria & items are required
    cy.caseStudyLoop({
      object: this.data.CS.solutionsWithAdditionalCriterion,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        const value = innerValue as { lower: number; upper: number }

        cy.get('[data-cy="save-new-question"]').should('be.disabled')
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        )
          .click()
          .type(String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        )
          .click()
          .type(String(value.upper))

        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        ).should('have.value', String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        ).should('have.value', String(value.upper))
      },
    })
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)
  })

  it('Verify that the sample solution has been stored correctly for the modified case study question', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.title
    )

    cy.caseStudyLoop({
      object: this.data.CS.solutionsWithAdditionalCriterion,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        const value = innerValue as { lower: number; upper: number }

        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        ).should('have.value', String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        ).should('have.value', String(value.upper))
      },
    })

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that the case study validation logic covers all required cases and block submission of invalid element edit modals', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()

    // missing question title -> invalid
    cy.get('[data-cy="insert-question-title"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-question-title"]').click().type(this.data.CS.title)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // missing question content -> invalid
    cy.get('[data-cy="insert-question-text"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CS.content)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // missing question explanation -> valid
    cy.get('[data-cy="insert-question-explanation"]').realClick().clear()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.CS.explanation)

    // range criterion name, min, max, step required -> invalid (if removed)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click() // disable sample solution to ensure origin or errors is the criterion
    cy.get('[data-cy="criterion-0-name"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-name"]')
      .click()
      .type(this.data.CS.criteria[0].name)

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-min"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .type(String(this.data.CS.criteria[0].min))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-max"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-max"]')
      .click()
      .type(String(this.data.CS.criteria[0].max))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-step"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-step"]')
      .click()
      .type(String(this.data.CS.criteria[0].step))
    cy.get('[data-cy="configure-sample-solution"]').click() // enable sample solution again (previous solution states should persist)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // step criterion name, labels min, labels max, step (min. 2) required -> invalid if removed
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click() // disable sample solution to ensure origin or errors is the criterion
    cy.get('[data-cy="criterion-2-name"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-name"]')
      .click()
      .type(this.data.CS.removedCriterion.name)

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-2-min-label"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-min-label"]')
      .click()
      .type(String(this.data.CS.removedCriterion.labels.min))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-2-mid-label"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled') // mid label is optional
    cy.get('[data-cy="criterion-2-mid-label"]')
      .click()
      .type(String(this.data.CS.removedCriterion.labels.mid))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-2-max-label"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-max-label"]')
      .click()
      .type(String(this.data.CS.removedCriterion.labels.max))

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-2-steps"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-steps"]').click().clear().type('0')
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-steps"]').click().clear().type('1')
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-2-steps"]').click().clear().type('2')
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-2-steps"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps))
    cy.get('[data-cy="configure-sample-solution"]').click() // enable sample solution again (previous solution states should persist)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // criterion min <= max required & max - min >= 2 * step -> otherwise invalid
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(this.data.CS.criteria[0].max + this.data.CS.criteria[0].step + 1)
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.criteria[0].max - 2 * this.data.CS.criteria[0].step + 1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.criteria[0].max - 2 * this.data.CS.criteria[0].step - 1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="criterion-0-min"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min))
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: lower and upper bound required
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="case-solution-1-3-0-upper"]').click().clear()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .type(this.data.CS.solutions[1][3][0].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: min <= max required
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].upper + 1)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: min and max lie within the bounds of the criterion
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min - 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].min + 1))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max + 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.criteria[0].max - 1))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-upper"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: max - min >= step size
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper -
            this.data.CS.criteria[0].step +
            1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper - this.data.CS.criteria[0].step
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(
        String(
          this.data.CS.solutions[1][3][0].upper -
            this.data.CS.criteria[0].step -
            1
        )
      )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-0-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutions[1][3][0].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: step criteria can have the same value for min and max, but min <= max needs to be satisfied
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-lower"]').click().clear().type('1')
    cy.get('[data-cy="case-solution-1-3-2-upper"]').click().clear().type('1')
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="case-solution-1-3-2-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps))
    cy.get('[data-cy="case-solution-1-3-2-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="case-solution-1-3-2-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps))
    cy.get('[data-cy="case-solution-1-3-2-upper"]').click().clear().type('1')
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    cy.get('[data-cy="case-solution-1-3-2-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutionsWithAdditionalCriterion[1][3][2].lower)
    cy.get('[data-cy="case-solution-1-3-2-upper"]')
      .click()
      .clear()
      .type(this.data.CS.solutionsWithAdditionalCriterion[1][3][2].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // solutions: solution needs to be within the bounds of the criterion
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-lower"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps + 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-lower"]').click().clear().type('0')
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-lower"]')
      .click()
      .clear()
      .type(this.data.CS.solutionsWithAdditionalCriterion[1][3][2].lower)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    cy.get('[data-cy="case-solution-1-3-2-upper"]')
      .click()
      .clear()
      .type(String(this.data.CS.removedCriterion.steps + 1))
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-upper"]').click().clear().type('0')
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="case-solution-1-3-2-upper"]')
      .click()
      .clear()
      .type(this.data.CS.solutionsWithAdditionalCriterion[1][3][2].upper)
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')
  })

  it('Edit the case study question, change the answer collection (including new sample solutions), and remove one criterion', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.title}"]`).click()
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .clear()
      .type(this.data.CS.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.CS.contentEdited)

    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="cancel-change-collection"]').click()
    cy.get('[data-cy="select-answer-collection"]').click()
    cy.get(
      `[data-cy="select-answer-collection-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="confirm-change-collection"]').click()
    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collectionEdited
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // answer options are cleared on collection change

    // select items for case study
    cy.wrap(this.data.CS.itemsEdited).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').click()
      cy.findByText(item).realClick()
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // remove one criterion
    cy.get(
      `[data-cy="remove-criterion-${this.data.CS.criteria.length}"]`
    ).click()
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-name"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-min"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-max"]`).should(
      'not.exist'
    )
    cy.get(`[data-cy="criterion-${this.data.CS.criteria.length}-step"]`).should(
      'not.exist'
    )

    // clear all fields, enter new criteria
    cy.wrap(this.data.CS.criteriaEdited).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`)
          .click()
          .clear()
          .type(criterion.name)

        // for range criteria, enter min, max, and step - unit is optional
        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`)
            .click()
            .clear()
            .type(String(criterion.min))
          cy.get(`[data-cy="criterion-${ix}-max"]`)
            .click()
            .clear()
            .type(String(criterion.max))
          cy.get(`[data-cy="criterion-${ix}-step"]`)
            .click()
            .clear()
            .type(String(criterion.step))
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`)
              .click()
              .type(criterion.unit)
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.min))
          cy.get(`[data-cy="criterion-${ix}-max-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.max))
          cy.get(`[data-cy="criterion-${ix}-steps"]`)
            .click()
            .clear()
            .type(String(criterion.steps))

          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`)
              .click()
              .clear()
              .type(String(criterion.labels.mid))
          }
        } else {
          throw new Error('Invalid criterion mode')
        }

        // validate inputs
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`).should(
            'have.value',
            String(criterion.min)
          )
          cy.get(`[data-cy="criterion-${ix}-max"]`).should(
            'have.value',
            String(criterion.max)
          )
          cy.get(`[data-cy="criterion-${ix}-step"]`).should(
            'have.value',
            String(criterion.step)
          )
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
              'have.value',
              criterion.unit
            )
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`).should(
            'have.value',
            criterion.labels.min
          )
          cy.get(`[data-cy="criterion-${ix}-max-label"]`).should(
            'have.value',
            criterion.labels.max
          )
          cy.get(`[data-cy="criterion-${ix}-steps"]`).should(
            'have.value',
            String(criterion.steps)
          )
          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`).should(
              'have.value',
              criterion.labels.mid
            )
          }
        } else {
          throw new Error('Invalid criterion mode')
        }
      }
    )

    // remove all existing cases
    for (let i = 0; i < this.data.CS.cases.length; i++) {
      cy.get(`[data-cy="delete-case-0"]`).click()
      cy.get(`[data-cy="confirm-delete-case"]`).click()
    }
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // cases required

    // add new cases
    cy.wrap(this.data.CS.casesEdited).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get('[data-cy="add-new-case"]').click()
        cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
        cy.get(`[data-cy="case-description-${ix}"]`)
          .realClick()
          .type(caseItem.description)

        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled') // solution required

    // add new sample solutions
    cy.caseStudyLoop({
      object: this.data.CS.solutionsEdited,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        const value = innerValue as { lower: number; upper: number }

        cy.get('[data-cy="save-new-question"]').should('be.disabled')
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        )
          .click()
          .type(String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        )
          .click()
          .type(String(value.upper))
      },
    })
    cy.get('[data-cy="save-new-question"]').click()
  })

  it('Verify that all changes to the case study question have been saved correctly', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS.titleEdited}"]`).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .contains(this.data.CS.contentEdited)

    cy.get('[data-cy="select-answer-collection"]').contains(
      this.data.CS.collectionEdited
    )
    cy.wrap(this.data.CS.itemsEdited).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    cy.wrap(this.data.CS.criteriaEdited).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`).should(
            'have.value',
            String(criterion.min)
          )
          cy.get(`[data-cy="criterion-${ix}-max"]`).should(
            'have.value',
            String(criterion.max)
          )
          cy.get(`[data-cy="criterion-${ix}-step"]`).should(
            'have.value',
            String(criterion.step)
          )
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`).should(
              'have.value',
              criterion.unit
            )
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`).should(
            'have.value',
            criterion.labels.min
          )
          cy.get(`[data-cy="criterion-${ix}-max-label"]`).should(
            'have.value',
            criterion.labels.max
          )
          cy.get(`[data-cy="criterion-${ix}-steps"]`).should(
            'have.value',
            String(criterion.steps)
          )
          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`).should(
              'have.value',
              criterion.labels.mid
            )
          }
        }
      }
    )

    cy.wrap(this.data.CS.casesEdited).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get(`[data-cy="case-title-${ix}"]`).should(
          'have.value',
          caseItem.title
        )
        cy.get(`[data-cy="case-description-${ix}"]`).contains(
          caseItem.description
        )
      }
    )

    cy.caseStudyLoop({
      object: this.data.CS.solutionsEdited,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        const value = innerValue as { lower: number; upper: number }

        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        ).should('have.value', String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        ).should('have.value', String(value.upper))
      },
    })

    cy.get('[data-cy="close-element-modal"]').click()
  })

  it('Verify that all elements of the previously used answer collection and the collection itself can be deleted again', function () {
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'not.have.attr',
      'data-disabled'
    )
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.findByText(messages.manage.resources.answerOptionUsed).should(
      'not.exist'
    )
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="delete-answer-collection"]').should(
      'have.attr',
      'data-disabled'
    )
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS.itemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.findByText(messages.manage.resources.answerOptionUsed).should('exist')
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Verify that after the deletion of the linked questions, all solution options can be deleted again', function () {
    cy.deleteElement({ elementName: this.data.CS.titleEdited })

    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collection}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItems).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()

    cy.get(
      `[data-cy="answer-collection-actions-${this.data.CS.collectionEdited}"]`
    ).click()
    cy.get('[data-cy="edit-answer-collection"]').click()
    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS.itemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.wrap(this.data.CS.unselectedItemsEdited).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should(
        'not.be.disabled'
      )
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })
  // #endregion

  // ! Inline Answer Collection Creation
  // #region
  it('Create a case study question with inline answer collection', function () {
    cy.get('[data-cy="create-question"]').click()
    cy.get('[data-cy="select-question-type"]').click()
    cy.get(
      `[data-cy="select-question-type-${messages.shared.CASE_STUDY.typeLabel}"]`
    ).click()
    cy.get('[data-cy="select-question-type"]')
      .should('exist')
      .contains(messages.shared.CASE_STUDY.typeLabel)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // enter question data
    cy.get('[data-cy="insert-question-title"]')
      .click()
      .type(this.data.CS_INLINE.title)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')
    cy.get('[data-cy="select-question-status"]').click()
    cy.get(
      `[data-cy="select-question-status-${messages.shared.READY.statusLabel}"]`
    ).click()
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .type(this.data.CS_INLINE.content)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .type(this.data.CS_INLINE.explanation)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // check if button for manual creation is present and click it
    cy.get('[data-cy="create-inline-answer-collection"]')
      .should('exist')
      .click()

    // enter items manually
    cy.wrap(this.data.CS_INLINE.items).each((item: string) => {
      cy.get('#inline-answer-collection-options').type(`${item}{enter}`)
    })
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // add criteria
    cy.wrap(this.data.CS_INLINE.criteria).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="add-${criterion.mode}-criterion"]`).click()
        cy.get(`[data-cy="criterion-${ix}-name"]`)
          .click()
          .clear()
          .type(criterion.name)

        if (criterion.mode === 'range') {
          cy.get(`[data-cy="criterion-${ix}-min"]`)
            .click()
            .clear()
            .type(String(criterion.min))
          cy.get(`[data-cy="criterion-${ix}-max"]`)
            .click()
            .clear()
            .type(String(criterion.max))
          cy.get(`[data-cy="criterion-${ix}-step"]`)
            .click()
            .clear()
            .type(String(criterion.step))
          if (criterion.unit) {
            cy.get(`[data-cy="criterion-${ix}-unit"]`)
              .click()
              .type(criterion.unit)
          }
        } else if (criterion.mode === 'steps') {
          cy.get(`[data-cy="criterion-${ix}-min-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.min))
          cy.get(`[data-cy="criterion-${ix}-max-label"]`)
            .click()
            .clear()
            .type(String(criterion.labels.max))
          cy.get(`[data-cy="criterion-${ix}-steps"]`)
            .click()
            .clear()
            .type(String(criterion.steps))

          if (criterion.labels.mid) {
            cy.get(`[data-cy="criterion-${ix}-mid-label"]`)
              .click()
              .clear()
              .type(String(criterion.labels.mid))
          }
        } else {
          throw new Error('Invalid criterion mode')
        }
      }
    )
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // add cases
    cy.wrap(this.data.CS_INLINE.cases).each(
      (caseItem: { title: string; description: string }, ix) => {
        cy.get('[data-cy="add-new-case"]').click()
        cy.get(`[data-cy="case-title-${ix}"]`).click().type(caseItem.title)
        cy.get(`[data-cy="case-description-${ix}"]`)
          .realClick()
          .type(caseItem.description)
      }
    )
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // add sample solution
    cy.get('[data-cy="configure-sample-solution"]').click()
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    cy.caseStudyLoop({
      object: this.data.CS_INLINE.solutions,
      callback: ({ caseIx, itemIx, criterionIx, innerValue }) => {
        const value = innerValue as { lower: number; upper: number }

        cy.get('[data-cy="save-new-question"]').should('be.disabled')
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-lower"]`
        )
          .click()
          .type(String(value.lower))
        cy.get(
          `[data-cy="case-solution-${caseIx}-${itemIx}-${criterionIx}-upper"]`
        )
          .click()
          .type(String(value.upper))
      },
    })
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // add another item
    const additionalItem = 'New Item'
    cy.get('#inline-answer-collection-options').type(`${additionalItem}{enter}`)
    cy.get('[data-cy="save-new-question"]').should('be.disabled')

    // add sample solutions for the new item and verify that the question can be saved
    cy.get(
      `[data-cy="case-solution-${0}-${this.data.CS_INLINE.items.length}-${0}-lower"]`
    )
      .click()
      .type(String(0))
    cy.get(
      `[data-cy="case-solution-${0}-${this.data.CS_INLINE.items.length}-${0}-upper"]`
    )
      .click()
      .type(String(10))
    cy.get(
      `[data-cy="case-solution-${0}-${this.data.CS_INLINE.items.length}-${1}-lower"]`
    )
      .click()
      .type(String(2))
    cy.get(
      `[data-cy="case-solution-${0}-${this.data.CS_INLINE.items.length}-${1}-upper"]`
    )
      .click()
      .type(String(3))
    cy.get(
      `[data-cy="case-solution-${1}-${this.data.CS_INLINE.items.length}-${0}-lower"]`
    )
      .click()
      .type(String(0))
    cy.get(
      `[data-cy="case-solution-${1}-${this.data.CS_INLINE.items.length}-${0}-upper"]`
    )
      .click()
      .type(String(10))
    cy.get(
      `[data-cy="case-solution-${1}-${this.data.CS_INLINE.items.length}-${1}-lower"]`
    )
      .click()
      .type(String(2))
    cy.get(
      `[data-cy="case-solution-${1}-${this.data.CS_INLINE.items.length}-${1}-upper"]`
    )
      .click()
      .type(String(3))
    cy.get('[data-cy="save-new-question"]').should('not.be.disabled')

    // remove the item again and save the question
    cy.get('#inline-answer-collection-options').should(
      'contain',
      additionalItem
    )
    cy.get('#inline-answer-collection-options').type(`{backspace}`)
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    cy.get(`[data-cy="element-item-${this.data.CS_INLINE.title}"]`).contains(
      this.data.CS_INLINE.content
    )
  })

  it('Verify that a new answer collection was created when creating the case study', function () {
    const collectionName = `AC Case Study ${this.data.CS_INLINE.title}`
    cy.get('[data-cy="resources"]').click()
    cy.get('[data-cy="answer-collections"]').click()
    cy.get(`[data-cy="answer-collection-actions-${collectionName}"]`).click()
    cy.get('[data-cy="edit-answer-collection"]').click()

    cy.get('[data-cy="open-answer-collection-options"]').click()
    cy.wrap(this.data.CS_INLINE.items).each((sol: string) => {
      cy.get(`[data-cy="delete-answer-option-${sol}"]`).should('be.disabled')
      cy.get(`[data-cy="edit-answer-option-${sol}"]`).should('not.be.disabled')
    })
    cy.get("[data-cy='close-answer-collection-edit-modal']").click()
  })

  it('Edit the inline created case study question', function () {
    cy.get(`[data-cy="edit-element-${this.data.CS_INLINE.title}"]`).click()

    // edit basic information
    cy.get('[data-cy="insert-question-title"]')
      .clear()
      .type(this.data.CS_INLINE.titleEdited)
    cy.get('[data-cy="insert-question-text"]')
      .realClick()
      .clear()
      .type(this.data.CS_INLINE.contentEdited)
    cy.get('[data-cy="insert-question-explanation"]')
      .realClick()
      .clear()
      .type(this.data.CS_INLINE.explanationEdited)

    // ensure that switching to manual item creation is not possible during editing
    cy.get('[data-cy="create-inline-answer-collection"]').should('not.exist')

    // save changes
    cy.get('[data-cy="save-new-question"]').click()
    cy.wait(500)

    // verify the changes were saved
    cy.get(
      `[data-cy="element-item-${this.data.CS_INLINE.titleEdited}"]`
    ).contains(this.data.CS_INLINE.contentEdited)
  })

  it('Verify that all changes to the inline created case study have been saved correctly', function () {
    cy.get(
      `[data-cy="edit-element-${this.data.CS_INLINE.titleEdited}"]`
    ).click()
    cy.get('[data-cy="insert-question-title"]').should(
      'have.value',
      this.data.CS_INLINE.titleEdited
    )
    cy.get('[data-cy="insert-question-text"]').contains(
      this.data.CS_INLINE.contentEdited
    )
    cy.get('[data-cy="insert-question-explanation"]').contains(
      this.data.CS_INLINE.explanationEdited
    )

    // verify items from the inline created collection are still selected
    cy.wrap(this.data.CS_INLINE.items).each((item: string) => {
      cy.get('[data-cy="choose-case-study-items"]').contains(item)
    })

    // verify criteria and sample solutions still exist
    cy.wrap(this.data.CS_INLINE.criteria).each(
      (criterion: CriterionDataType, ix) => {
        cy.get(`[data-cy="criterion-${ix}-name"]`).should(
          'have.value',
          criterion.name
        )
      }
    )
    cy.get('[data-cy="close-element-modal"]').click()
  })
  // #endregion
})
