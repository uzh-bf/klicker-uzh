import {
  computeAwardedPoints,
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '../src/index.js'

describe('@klicker-uzh/grading', () => {
  it('should grade MC questions correctly', () => {
    const points = gradeQuestionMC({
      responseCount: 6,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: true },
        { ix: 3, selected: true },
        { ix: 4, selected: true },
        { ix: 5, selected: true },
      ],
      solution: [0, 1, 3],
    })

    expect(points).toEqual(0)

    const points2 = gradeQuestionMC({
      responseCount: 6,
      // response: [0, 1, 3],
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: false },
        { ix: 3, selected: true },
        { ix: 4, selected: false },
        { ix: 5, selected: false },
      ],
      solution: [0, 1, 3],
    })

    expect(points2).toEqual(1)

    const points3 = gradeQuestionMC({
      responseCount: 4,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: false },
        { ix: 3, selected: true },
      ],
      solution: [0, 1],
    })

    expect(points3).toEqual(0.5)
  })

  it('should grade SC questions correctly', () => {
    const points = gradeQuestionSC({
      responseCount: 6,
      response: [
        { ix: 0, selected: false },
        { ix: 1, selected: true },
        { ix: 2, selected: false },
        { ix: 3, selected: false },
        { ix: 4, selected: false },
        { ix: 5, selected: false },
      ],
      solution: [0],
    })

    expect(points).toEqual(0)

    const points2 = gradeQuestionSC({
      responseCount: 4,
      response: [
        { ix: 0, selected: false },
        { ix: 1, selected: false },
        { ix: 2, selected: false },
        { ix: 3, selected: true },
      ],
      solution: [3],
    })

    expect(points2).toEqual(1)
  })

  it('should grade KPRIM questions correctly', () => {
    const points = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: false },
        { ix: 1, selected: true },
        { ix: 2, selected: true },
        { ix: 3, selected: true },
      ],
      solution: [0, 1, 3],
    })
    expect(points).toEqual(0)

    const points2 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: false },
        { ix: 1, selected: false },
        { ix: 2, selected: true },
        { ix: 3, selected: false },
      ],
      solution: [0, 1, 3],
    })
    expect(points2).toEqual(0)

    const points3 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: false },
        { ix: 3, selected: true },
      ],
      solution: [0, 1, 3],
    })
    expect(points3).toEqual(1)

    const points4 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: false },
        { ix: 3, selected: true },
      ],
      solution: [0, 1],
    })
    expect(points4).toEqual(0.5)

    const points5 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: false },
        { ix: 1, selected: false },
        { ix: 2, selected: false },
        { ix: 3, selected: false },
      ],
      solution: [],
    })
    expect(points5).toEqual(1)

    const points6 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: true },
        { ix: 2, selected: true },
        { ix: 3, selected: true },
      ],
      solution: [],
    })
    expect(points6).toEqual(0)

    const points7 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [
        { ix: 0, selected: true },
        { ix: 1, selected: false },
        { ix: 2, selected: false },
        { ix: 3, selected: false },
      ],
      solution: [],
    })
    expect(points7).toEqual(0.5)
  })

  it('should grade NUMERICAL questions correctly', () => {
    const points = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 5,
    })
    expect(points).toEqual(1)

    const points2 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 10,
    })
    expect(points2).toEqual(1)

    const points3 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 16,
    })
    expect(points3).toEqual(1)

    const points4 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 50,
    })
    expect(points4).toEqual(0)

    const points5 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 70,
    })
    expect(points5).toEqual(1)

    const points6 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 70.11,
    })
    expect(points6).toEqual(0)

    const points7 = gradeQuestionNumerical({
      solutionRanges: [
        { max: 10 },
        { min: 13, max: 30 },
        { min: 70, max: 70 },
        { min: 90 },
      ],
      response: 95,
    })
    expect(points7).toEqual(1)

    const points8 = gradeQuestionNumerical({
      solutionRanges: [],
      response: 0,
    })
    expect(points8).toEqual(null)

    const points9 = gradeQuestionNumerical({
      exactSolutions: [0],
      response: 0,
    })
    expect(points9).toEqual(1)

    const points10 = gradeQuestionNumerical({
      exactSolutions: [0],
      response: 1,
    })
    expect(points10).toEqual(0)

    const points11 = gradeQuestionNumerical({
      exactSolutions: [0, 100],
      response: 0,
    })
    expect(points11).toEqual(1)

    const points12 = gradeQuestionNumerical({
      exactSolutions: [0, 100],
      response: 100,
    })
    expect(points12).toEqual(1)

    const points13 = gradeQuestionNumerical({
      exactSolutions: [0, 100],
      response: 50,
    })
    expect(points13).toEqual(0)

    const points14 = gradeQuestionNumerical({
      exactSolutions: [0, 100],
      response: 1e-30,
    })
    expect(points14).toEqual(1)

    const points15 = gradeQuestionNumerical({
      exactSolutions: [0.1],
      response: 0.1,
    })
    expect(points15).toEqual(1)

    const points16 = gradeQuestionNumerical({
      exactSolutions: [0.1],
      response: 0.5,
    })
    expect(points16).toEqual(0)

    const points17 = gradeQuestionNumerical({
      exactSolutions: [],
      response: 0.1,
    })
    expect(points17).toEqual(null)

    const zeroUpperBound = gradeQuestionNumerical({
      solutionRanges: [{ max: 0 }],
      response: 1,
    })
    expect(zeroUpperBound).toEqual(0)

    const zeroLowerBound = gradeQuestionNumerical({
      solutionRanges: [{ min: 0 }],
      response: -1,
    })
    expect(zeroLowerBound).toEqual(0)
  })

  it('should grade FREE_TEXT questions correctly', () => {
    const points = gradeQuestionFreeText({
      solutions: ['Solution 1', 'Solution 2'],
      response: 'solution 1',
    })
    expect(points).toEqual(1)

    const points2 = gradeQuestionFreeText({
      solutions: ['Solution 1', 'Solution 2'],
      response: 'Solution 1',
    })
    expect(points2).toEqual(1)

    const points3 = gradeQuestionFreeText({
      solutions: ['Solution 1', 'Solution 2'],
      response: 'Solution 1',
    })
    expect(points3).toEqual(1)

    const points4 = gradeQuestionFreeText({
      solutions: ['Solution 1', 'Solution 2'],
      response: 'Test',
    })
    expect(points4).toEqual(0)

    const points5 = gradeQuestionFreeText({
      solutions: [],
      response: 'Test',
    })
    expect(points5).toEqual(null)

    const points6 = gradeQuestionFreeText({
      solutions: undefined,
      response: 'Test',
    })
    expect(points6).toEqual(null)

    const points7 = gradeQuestionFreeText({
      solutions: null,
      response: 'Test',
    })
    expect(points7).toEqual(null)
  })

  it('should grade SELECTION questions correctly', () => {
    // no sample solution
    const grade1 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: null,
    })
    expect(grade1).toEqual(null)

    const grade2 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: [],
    })
    expect(grade2).toEqual(null)

    const grade3 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: undefined,
    })
    expect(grade3).toEqual(null)

    // all correct
    const grade4 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: [0, 1, 2, 3],
    })
    expect(grade4).toEqual(1)

    const grade5 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: [3, 2, 1, 0],
    })
    expect(grade5).toEqual(1)

    const grade6 = gradeQuestionSelection({
      numberOfInputs: 2,
      response: [0, 1],
      correctAnswers: [0, 1, 2],
    })
    expect(grade6).toEqual(1)

    // partial correct
    const grade7 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 4],
      correctAnswers: [0, 1, 2, 3],
    })
    expect(grade7).toEqual(0.75)

    const grade8 = gradeQuestionSelection({
      numberOfInputs: 6,
      response: [0, 1, 2, 3, 4, 5],
      correctAnswers: [0, 1, 7, 8, 9, 10, 11],
    })
    expect(grade8).toBeCloseTo(0.33, 2)

    // single one correct
    const grade9 = gradeQuestionSelection({
      numberOfInputs: 5,
      response: [0, 1, 2, 3, 4],
      correctAnswers: [0, 5, 6, 7, 8, 9],
    })
    expect(grade9).toEqual(0.2)

    // no correct
    const grade10 = gradeQuestionSelection({
      numberOfInputs: 4,
      response: [0, 1, 2, 3],
      correctAnswers: [4, 5, 6, 7],
    })
    expect(grade10).toEqual(0)

    const grade11 = gradeQuestionSelection({
      numberOfInputs: 3,
      response: [0, 1, 2],
      correctAnswers: [3, 4, 5, 6, 7],
    })
    expect(grade11).toEqual(0)
  })

  it('should grade CASE_STUDY questions correctly', () => {
    // missing sample solution (undefined / null)
    const grade1 = gradeQuestionCaseStudy({
      response: [],
      solutions: undefined,
    })
    expect(grade1).toEqual(null)

    const grade2 = gradeQuestionCaseStudy({
      response: [],
      solutions: null,
    })
    expect(grade2).toEqual(null)

    const grade3 = gradeQuestionCaseStudy({
      response: [],
      solutions: [],
    })
    expect(grade3).toEqual(null)

    // minimal scenario (1 case, 1 item, 1 criterion) - correct / wrong / value on correctness boundaries / slightly above / below
    const minScenarioSolutions = [
      {
        caseId: 'iLVwZltIbP',
        itemSolutions: [
          {
            itemId: 1,
            criteriaSolutions: [
              { criterionId: 'lnmcuMWRcw', min: 0.1, max: 10 },
            ],
          },
        ],
      },
    ]
    const minScenarioCorrect = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [{ criterionId: 'lnmcuMWRcw', response: 5 }],
          },
        ],
      },
    ]
    const minScenarioCorrectObject = {
      iLVwZltIbP: {
        '1': {
          lnmcuMWRcw: 5,
        },
      },
    }
    const minScenarioIncorrect = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [{ criterionId: 'lnmcuMWRcw', response: -5 }],
          },
        ],
      },
    ]
    const minScenarioIncorrectObject = {
      iLVwZltIbP: {
        '1': {
          lnmcuMWRcw: -5,
        },
      },
    }
    const minScenarioLowerBoundary = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [{ criterionId: 'lnmcuMWRcw', response: 0.1 }],
          },
        ],
      },
    ]
    const minScenarioLowerBoundaryObject = {
      iLVwZltIbP: {
        '1': {
          lnmcuMWRcw: 0.1,
        },
      },
    }
    const minScenarioUpperBoundary = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [{ criterionId: 'lnmcuMWRcw', response: 10 }],
          },
        ],
      },
    ]
    const minScenarioBelowBoundary = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'lnmcuMWRcw', response: 0.1 - 2 * Number.EPSILON },
            ],
          },
        ],
      },
    ]
    const minScenarioAboveBoundary = [
      {
        caseId: 'iLVwZltIbP',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'lnmcuMWRcw', response: 10 + 5 * Number.EPSILON },
            ],
          },
        ],
      },
    ]

    const grade4 = gradeQuestionCaseStudy({
      response: minScenarioCorrect,
      solutions: minScenarioSolutions,
    })
    expect(grade4).toEqual(1)

    const grade4Obj = gradeQuestionCaseStudy({
      response: minScenarioCorrectObject,
      solutions: minScenarioSolutions,
    })
    expect(grade4Obj).toEqual(1)

    const grade5 = gradeQuestionCaseStudy({
      response: minScenarioIncorrect,
      solutions: minScenarioSolutions,
    })
    expect(grade5).toEqual(0)

    const grade5Obj = gradeQuestionCaseStudy({
      response: minScenarioIncorrectObject,
      solutions: minScenarioSolutions,
    })
    expect(grade5Obj).toEqual(0)

    const grade6 = gradeQuestionCaseStudy({
      response: minScenarioLowerBoundary,
      solutions: minScenarioSolutions,
    })
    expect(grade6).toEqual(1)

    const grade6Obj = gradeQuestionCaseStudy({
      response: minScenarioLowerBoundaryObject,
      solutions: minScenarioSolutions,
    })
    expect(grade6Obj).toEqual(1)

    const grade7 = gradeQuestionCaseStudy({
      response: minScenarioUpperBoundary,
      solutions: minScenarioSolutions,
    })
    expect(grade7).toEqual(1)

    const grade8 = gradeQuestionCaseStudy({
      response: minScenarioBelowBoundary,
      solutions: minScenarioSolutions,
    })
    expect(grade8).toEqual(0)

    const grade9 = gradeQuestionCaseStudy({
      response: minScenarioAboveBoundary,
      solutions: minScenarioSolutions,
    })
    expect(grade9).toEqual(0)

    // extended scenario (1 case, 2 items, 3 criteria) - correct / partial / wrong / partially missing response (missing = wrong)
    const singleCaseSolutions = [
      {
        caseId: 'oYXpqxVHlc',
        itemSolutions: [
          {
            itemId: 1,
            criteriaSolutions: [
              { criterionId: 'ZxZ__w6JDo', min: 0.1, max: 10 },
              { criterionId: 'OTA9w3CV_d', min: 0.2, max: 20 },
              { criterionId: '_6CyIiKyxq', min: 0.3, max: 30 },
            ],
          },
          {
            itemId: 2,
            criteriaSolutions: [
              { criterionId: 'gxeraKdd9S', min: 1, max: 100 },
              { criterionId: 'MrZZYfr2Ue', min: 2, max: 200 },
              { criterionId: 'BoH0JvaZAW', min: 3, max: 300 },
            ],
          },
        ],
      },
    ]
    const correctResponse = [
      {
        caseId: 'oYXpqxVHlc',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'ZxZ__w6JDo', response: 5 },
              { criterionId: 'OTA9w3CV_d', response: 10 },
              { criterionId: '_6CyIiKyxq', response: 15 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'gxeraKdd9S', response: 50 },
              { criterionId: 'MrZZYfr2Ue', response: 100 },
              { criterionId: 'BoH0JvaZAW', response: 150 },
            ],
          },
        ],
      },
    ]
    const partialCorrectResponse = [
      {
        caseId: 'oYXpqxVHlc',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'ZxZ__w6JDo', response: -5 },
              { criterionId: 'OTA9w3CV_d', response: -10 },
              { criterionId: '_6CyIiKyxq', response: 15 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'gxeraKdd9S', response: -50 },
              { criterionId: 'MrZZYfr2Ue', response: -100 },
              { criterionId: 'BoH0JvaZAW', response: 150 },
            ],
          },
        ],
      },
    ]
    const wrongResponse = [
      {
        caseId: 'oYXpqxVHlc',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'ZxZ__w6JDo', response: -5 },
              { criterionId: 'OTA9w3CV_d', response: -10 },
              { criterionId: '_6CyIiKyxq', response: -15 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'gxeraKdd9S', response: -50 },
              { criterionId: 'MrZZYfr2Ue', response: -100 },
              { criterionId: 'BoH0JvaZAW', response: -150 },
            ],
          },
        ],
      },
    ]
    const partialMissingResponse = [
      {
        caseId: 'oYXpqxVHlc',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: 'ZxZ__w6JDo', response: 5 },
              { criterionId: 'OTA9w3CV_d', response: 10 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [{ criterionId: 'gxeraKdd9S', response: 50 }],
          },
        ],
      },
    ]

    const grade10 = gradeQuestionCaseStudy({
      response: correctResponse,
      solutions: singleCaseSolutions,
    })
    expect(grade10).toEqual(1)

    const grade11 = gradeQuestionCaseStudy({
      response: partialCorrectResponse,
      solutions: singleCaseSolutions,
    })
    expect(grade11).toBeCloseTo(1 / 3, 4)

    const grade12 = gradeQuestionCaseStudy({
      response: wrongResponse,
      solutions: singleCaseSolutions,
    })
    expect(grade12).toEqual(0)

    const grade13 = gradeQuestionCaseStudy({
      response: partialMissingResponse,
      solutions: singleCaseSolutions,
    })
    expect(grade13).toEqual(0.5)

    // extended scenario (2 cases, 2 items, 2 criteria) - correct / partial / wrong
    const extendedCaseSolutions = [
      {
        caseId: '79H4ZEZgPH',
        itemSolutions: [
          {
            itemId: 1,
            criteriaSolutions: [
              { criterionId: '0uD_6bdzdK', min: 1, max: 2 },
              { criterionId: 'HbTvnNgqi2', min: 3, max: 4 },
            ],
          },
          {
            itemId: 2,
            criteriaSolutions: [
              { criterionId: 'tkBKPtfp_F', min: 100, max: 200 },
              { criterionId: 'pllKZBz9bR', min: 300, max: 400 },
            ],
          },
        ],
      },
      {
        caseId: 'eP02ejbh9e',
        itemSolutions: [
          {
            itemId: 3,
            criteriaSolutions: [
              { criterionId: 'PsScPn4zIW', min: 1000, max: 2000 },
              { criterionId: 'c6YIO3Icgb', min: 3000, max: 4000 },
            ],
          },
          {
            itemId: 4,
            criteriaSolutions: [
              { criterionId: 'YBCkjkK51v', min: -200, max: -100 },
              { criterionId: 'znjuifvBDa', min: -400, max: -300 },
            ],
          },
        ],
      },
    ]
    const extendedCorrectResponse = [
      {
        caseId: '79H4ZEZgPH',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: '0uD_6bdzdK', response: 1 },
              { criterionId: 'HbTvnNgqi2', response: 3.5 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'tkBKPtfp_F', response: 150 },
              { criterionId: 'pllKZBz9bR', response: 350 },
            ],
          },
        ],
      },
      {
        caseId: 'eP02ejbh9e',
        itemResponses: [
          {
            itemId: 3,
            criterionResponses: [
              { criterionId: 'PsScPn4zIW', response: 1500 },
              { criterionId: 'c6YIO3Icgb', response: 3500 },
            ],
          },
          {
            itemId: 4,
            criterionResponses: [
              { criterionId: 'YBCkjkK51v', response: -150 },
              { criterionId: 'znjuifvBDa', response: -350 },
            ],
          },
        ],
      },
    ]
    const extendedPartialCorrectResponse = [
      {
        caseId: '79H4ZEZgPH',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: '0uD_6bdzdK', response: 1 },
              { criterionId: 'HbTvnNgqi2', response: 3 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'tkBKPtfp_F', response: 150 },
              { criterionId: 'pllKZBz9bR', response: 350 },
            ],
          },
        ],
      },
      {
        caseId: 'eP02ejbh9e',
        itemResponses: [
          {
            itemId: 3,
            criterionResponses: [
              { criterionId: 'PsScPn4zIW', response: -1500 },
              { criterionId: 'c6YIO3Icgb', response: -3500 },
            ],
          },
          {
            itemId: 4,
            criterionResponses: [
              { criterionId: 'YBCkjkK51v', response: -150 },
              { criterionId: 'znjuifvBDa', response: -350 },
            ],
          },
        ],
      },
    ]
    const extendedWrongResponse = [
      {
        caseId: '79H4ZEZgPH',
        itemResponses: [
          {
            itemId: 1,
            criterionResponses: [
              { criterionId: '0uD_6bdzdK', response: -1 },
              { criterionId: 'HbTvnNgqi2', response: 100 },
            ],
          },
          {
            itemId: 2,
            criterionResponses: [
              { criterionId: 'tkBKPtfp_F', response: 0 },
              { criterionId: 'pllKZBz9bR', response: 0 },
            ],
          },
        ],
      },
      {
        caseId: 'eP02ejbh9e',
        itemResponses: [
          {
            itemId: 3,
            criterionResponses: [
              { criterionId: 'PsScPn4zIW', response: -1500 },
              { criterionId: 'c6YIO3Icgb', response: -3500 },
            ],
          },
          {
            itemId: 4,
            criterionResponses: [
              { criterionId: 'YBCkjkK51v', response: 150 },
              { criterionId: 'znjuifvBDa', response: 350 },
            ],
          },
        ],
      },
    ]

    const grade14 = gradeQuestionCaseStudy({
      response: extendedCorrectResponse,
      solutions: extendedCaseSolutions,
    })
    expect(grade14).toEqual(1)

    const grade15 = gradeQuestionCaseStudy({
      response: extendedPartialCorrectResponse,
      solutions: extendedCaseSolutions,
    })
    expect(grade15).toBeCloseTo(0.75, 4)

    const grade16 = gradeQuestionCaseStudy({
      response: extendedWrongResponse,
      solutions: extendedCaseSolutions,
    })
    expect(grade16).toEqual(0)
  })

  it('should compute the awarded points correctly for live quizzes', () => {
    const points = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      basePoints: true,
      pointsPercentage: 1,
      roundedResult: true,
    })
    expect(points).toEqual(45)

    const pointsMultiplier = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(pointsMultiplier).toEqual(80)

    const points2 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: true,
      roundedResult: true,
    })
    expect(points2).toEqual(45)

    const points2Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: true,
      pointsMultiplier: 3,
      roundedResult: true,
    })
    expect(points2Multiplier).toEqual(115)

    const points3 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: true,
    })
    expect(points3).toEqual(28)

    const points3Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points3Multiplier).toEqual(45)

    const points4 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(points4).toEqual(30)

    const points4Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points4Multiplier).toEqual(50)

    const points5 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: true,
    })
    expect(points5).toEqual(20)

    const points6 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: true,
      roundedResult: true,
    })
    expect(points6).toEqual(30)

    const points6Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points6Multiplier).toEqual(50)

    const points7 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0,
      basePoints: true,
      roundedResult: true,
    })
    expect(points7).toEqual(10)

    const points7Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 11000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0,
      basePoints: true,
      pointsMultiplier: 3,
      roundedResult: true,
    })
    expect(points7Multiplier).toEqual(10)

    const points8 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(points8).toEqual(15)

    const points8Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points8Multiplier).toEqual(20)

    const points9 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      basePoints: true,
      pointsPercentage: 0,
      roundedResult: true,
    })
    expect(points9).toEqual(10)

    const points9Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points9Multiplier).toEqual(10)

    const points10 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      basePoints: true,
      pointsPercentage: 0.5,
      roundedResult: true,
    })
    expect(points10).toEqual(13)

    const points10Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 21000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points10Multiplier).toEqual(15)

    // test that base points are not awarded if corresponding option is disabled
    const points11 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      basePoints: false,
      pointsPercentage: 1,
      roundedResult: true,
    })
    expect(points11).toEqual(35)

    const points11Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: false,
      pointsMultiplier: 2,
      roundedResult: true,
    })
    expect(points11Multiplier).toEqual(70)

    const points12 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: false,
      roundedResult: true,
    })
    expect(points12).toEqual(35)

    const points12Multiplier = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: true,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: null,
      basePoints: false,
      pointsMultiplier: 3,
      roundedResult: true,
    })
    expect(points12Multiplier).toEqual(105)

    // verify that rounding parameter is handled correclty
    const floatPoints = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: false,
    })
    expect(floatPoints).toEqual(27.5)

    const roundedPoints = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: true,
    })
    expect(roundedPoints).toEqual(28)

    const floatPoints2 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 4.5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: false,
    })
    expect(floatPoints2).toEqual(27.25)

    const roundedPoints2 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 4.5,
      pointsPercentage: 0.5,
      basePoints: true,
      roundedResult: true,
    })
    expect(roundedPoints2).toEqual(27)

    // make sure that negative response timestamps with respect to the first response default to same time
    const edgeCase1 = computeAwardedPoints({
      firstResponseReceivedAt: '1000',
      responseTimestamp: 500,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(edgeCase1).toEqual(45)

    // make sure that zero time to zero bonus does not cause division by zero -> defaults to 1
    const edgeCase2 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 20,
      timeToZeroBonus: 0,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(edgeCase2).toEqual(35)

    // make sure that negative base points are not accepted -> default to zero
    const edgeCase3 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: -10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(edgeCase3).toEqual(35)

    // make sure that negative correctness points are not accepted -> default to zero
    const edgeCase4 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: -5,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(edgeCase4).toEqual(40)

    // make sure that negative bonus points are not accepted -> default to zero
    const edgeCase5 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: -30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 15,
      pointsPercentage: 1,
      basePoints: true,
      roundedResult: true,
    })
    expect(edgeCase5).toEqual(25)

    // make sure that zero or negative multipliers are not accepted -> default to 1
    const edgeCase6 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      pointsMultiplier: 0,
      roundedResult: true,
    })
    expect(edgeCase6).toEqual(45)

    const edgeCase7 = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
      basePoints: true,
      pointsMultiplier: -3,
      roundedResult: true,
    })
    expect(edgeCase7).toEqual(45)
  })

  it('should compute the awarded points correctly for practice quizzes and microlearnings', () => {
    const points = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 1,
    })
    expect(points).toEqual(10)

    const pointsMultiplier = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 1,
      pointsMultiplier: 2,
    })
    expect(pointsMultiplier).toEqual(20)

    const points2 = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 0.5,
    })
    expect(points2).toEqual(5)

    const points2Multiplier = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 0.5,
      pointsMultiplier: 2,
    })
    expect(points2Multiplier).toEqual(10)

    const points3 = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 0.45,
    })
    expect(points3).toEqual(5)

    const points3Multiplier = computeSimpleAwardedPoints({
      points: 10,
      pointsPercentage: 0.45,
      pointsMultiplier: 2,
    })
    expect(points3Multiplier).toEqual(9)
  })

  it('should compute the rewarded XP correctly', () => {
    const xp = computeAwardedXp({
      pointsPercentage: 1,
    })
    expect(xp).toEqual(10)

    const xp2 = computeAwardedXp({
      pointsPercentage: 0.5,
    })
    expect(xp2).toEqual(0)

    const xp3 = computeAwardedXp({
      pointsPercentage: 0,
    })
    expect(xp3).toEqual(0)
  })
})
