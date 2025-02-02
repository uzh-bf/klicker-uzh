import {
  computeAwardedPoints,
  computeAwardedXp,
  computeSimpleAwardedPoints,
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
      response: [0, 1, 2, 3, 4, 5],
      solution: [0, 1, 3],
    })

    expect(points).toEqual(0)

    const points2 = gradeQuestionMC({
      responseCount: 6,
      response: [0, 1, 3],
      solution: [0, 1, 3],
    })

    expect(points2).toEqual(1)

    const points3 = gradeQuestionMC({
      responseCount: 4,
      response: [0, 1, 3],
      solution: [0, 1],
    })

    expect(points3).toEqual(0.5)
  })

  it('should grade SC questions correctly', () => {
    const points = gradeQuestionSC({
      responseCount: 6,
      response: [0, 1, 2, 3, 4, 5],
      solution: [0],
    })

    expect(points).toEqual(0)

    const points2 = gradeQuestionSC({
      responseCount: 4,
      response: [3],
      solution: [3],
    })

    expect(points2).toEqual(1)
  })

  it('should grade KPRIM questions correctly', () => {
    const points = gradeQuestionKPRIM({
      responseCount: 6,
      response: [0, 1, 2, 3, 4, 5],
      solution: [0, 1, 3],
    })

    expect(points).toEqual(0)

    const points2 = gradeQuestionKPRIM({
      responseCount: 6,
      response: [0, 1, 3],
      solution: [0, 1, 3],
    })

    expect(points2).toEqual(1)

    const points3 = gradeQuestionKPRIM({
      responseCount: 4,
      response: [0, 1, 3],
      solution: [0, 1],
    })

    expect(points3).toEqual(0.5)
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

  it('should compute the awarded points correctly for live quizzes', () => {
    const points = computeAwardedPoints({
      firstResponseReceivedAt: null,
      responseTimestamp: 2000,
      maxBonus: 30,
      timeToZeroBonus: 20,
      getsMaxPoints: false,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      pointsPercentage: 1,
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
      pointsMultiplier: 2,
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
      pointsMultiplier: 3,
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
      pointsMultiplier: 2,
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
      pointsMultiplier: 2,
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
      pointsMultiplier: 2,
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
      pointsMultiplier: 3,
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
      pointsMultiplier: 2,
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
      pointsPercentage: 0,
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
      pointsMultiplier: 2,
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
      pointsPercentage: 0.5,
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
      pointsMultiplier: 2,
    })
    expect(points10Multiplier).toEqual(15)
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
