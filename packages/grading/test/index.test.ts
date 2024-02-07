import {
  computeAwardedPoints,
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '../src/index'

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
