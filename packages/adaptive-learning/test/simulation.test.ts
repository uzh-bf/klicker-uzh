import { describe, expect, it } from 'vitest'
import {
  aggregateWeightedEstimates,
  deriveGuessingParameter,
  mapLevelsToTheta,
  selectNextItem,
  selectSubCompetence,
  updateTheta,
  type AdaptiveItem,
  type AdaptiveResponse,
} from '../src/index.js'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((label, order) => ({
  label,
  order,
}))
const MAPPED_LEVELS = mapLevelsToTheta(LEVELS)
const COMPETENCE_COUNT = 3
const SUBMODULES_PER_COMPETENCE = 15
const ITEMS_PER_LEVEL_PER_SUBMODULE = 5
const DISCRIMINATION = 1.5
const UNEXPECTED_RESPONSE_PROBABILITY = 0.03
const SUBMODULE_ITEM_CAP = 8
const SUBMODULE_SE_THRESHOLD = 0.55
const TOTAL_ITEM_CAP = 240
const LEARNERS_PER_LEVEL = 24

type SimulationItem = AdaptiveItem & {
  competenceIndex: number
  submoduleIndex: number
  levelIndex: number
}

type CompetenceState = {
  responses: AdaptiveResponse[]
  submodules: Array<{ responses: AdaptiveResponse[]; stopped: boolean }>
}

type SimulationResult = {
  expectedLevel: string
  estimatedLevel: string
  theta: number
  standardError: number
  answeredQuestions: number
}

describe('adaptive-learning CEFR simulation', () => {
  it('recovers the expected CEFR level for most simulated test takers', () => {
    const itemPool = buildItemPool()
    const results = LEVELS.flatMap((level) =>
      Array.from({ length: LEARNERS_PER_LEVEL }, (_, learnerIndex) =>
        simulateLearner({
          itemPool,
          expectedLevelIndex: level.order,
          random: mulberry32(10_000 + level.order * 1_000 + learnerIndex),
        })
      )
    )

    const exactMatches = results.filter(
      (result) => result.estimatedLevel === result.expectedLevel
    )
    const exactMatchRate = exactMatches.length / results.length
    const levelDistances = results.map((result) =>
      Math.abs(
        levelIndex(result.estimatedLevel) - levelIndex(result.expectedLevel)
      )
    )
    const adjacentOrExactRate =
      levelDistances.filter((distance) => distance <= 1).length / results.length
    const meanAbsoluteLevelError =
      levelDistances.reduce((sum, distance) => sum + distance, 0) /
      levelDistances.length
    expect(exactMatchRate).toBeGreaterThanOrEqual(0.7)
    expect(adjacentOrExactRate).toBeGreaterThanOrEqual(0.95)
    expect(meanAbsoluteLevelError).toBeLessThanOrEqual(0.35)

    for (const level of LEVELS) {
      const levelResults = results.filter(
        (result) => result.expectedLevel === level.label
      )
      const levelExactMatchRate =
        levelResults.filter((result) => result.estimatedLevel === level.label)
          .length / levelResults.length

      expect(levelExactMatchRate).toBeGreaterThanOrEqual(0.55)
    }
  })
})

function simulateLearner({
  itemPool,
  expectedLevelIndex,
  random,
}: {
  itemPool: SimulationItem[]
  expectedLevelIndex: number
  random: () => number
}): SimulationResult {
  const expectedLevel = LEVELS[expectedLevelIndex]!
  const competenceStates: CompetenceState[] = Array.from(
    { length: COMPETENCE_COUNT },
    () => ({
      responses: [],
      submodules: Array.from({ length: SUBMODULES_PER_COMPETENCE }, () => ({
        responses: [],
        stopped: false,
      })),
    })
  )
  const answeredItemIds = new Set<string>()
  let totalAnsweredQuestions = 0

  while (
    totalAnsweredQuestions < TOTAL_ITEM_CAP &&
    !allCompetencesStopped(competenceStates, itemPool, answeredItemIds)
  ) {
    let answeredInCycle = false

    for (
      let competenceIndex = 0;
      competenceIndex < COMPETENCE_COUNT &&
      totalAnsweredQuestions < TOTAL_ITEM_CAP;
      competenceIndex += 1
    ) {
      const competenceState = competenceStates[competenceIndex]!

      if (
        isCompetenceStopped({
          competenceState,
          itemPool,
          answeredItemIds,
          competenceIndex,
        })
      ) {
        continue
      }

      const selectedSubmodule = selectSubCompetence({
        candidates: competenceState.submodules.map(
          (submodule, submoduleIndex) => ({
            competenceId: String(competenceIndex),
            subCompetenceId: String(submoduleIndex),
            enabled: !submodule.stopped,
            stopped: submodule.stopped,
            answeredQuestions: submodule.responses.length,
            questionThreshold: SUBMODULE_ITEM_CAP,
            coverage: remainingLevelCoverage({
              itemPool,
              answeredItemIds,
              competenceIndex,
              submoduleIndex,
            }),
          })
        ),
        random,
      })

      if (!selectedSubmodule) continue

      const submoduleIndex = Number(selectedSubmodule.subCompetenceId)
      const submoduleState = competenceState.submodules[submoduleIndex]!
      const submoduleTheta = updateTheta({
        responses: submoduleState.responses,
        initialTheta: competenceTheta(competenceState),
      }).theta
      const candidateItems = itemPool.filter(
        (item) =>
          item.competenceIndex === competenceIndex &&
          item.submoduleIndex === submoduleIndex
      )
      const selectedItem = selectNextItem({
        theta: submoduleTheta,
        items: candidateItems,
        answeredItemIds,
        random,
      }) as SimulationItem | null

      if (!selectedItem) {
        submoduleState.stopped = true
        continue
      }

      const response: AdaptiveResponse = {
        item: selectedItem,
        correct: simulateAnswer({
          itemLevelIndex: selectedItem.levelIndex,
          expectedLevelIndex,
          random,
        }),
      }

      answeredItemIds.add(String(selectedItem.id))
      submoduleState.responses.push(response)
      competenceState.responses.push(response)
      totalAnsweredQuestions += 1
      answeredInCycle = true

      const nextSubmoduleState = updateTheta({
        responses: submoduleState.responses,
      })
      if (
        submoduleState.responses.length >= SUBMODULE_ITEM_CAP ||
        nextSubmoduleState.standardError <= SUBMODULE_SE_THRESHOLD ||
        remainingLevelCoverage({
          itemPool,
          answeredItemIds,
          competenceIndex,
          submoduleIndex,
        }) === 0
      ) {
        submoduleState.stopped = true
      }
    }

    if (!answeredInCycle) break
  }

  const competenceEstimates = competenceStates.flatMap((competenceState) => {
    if (competenceState.responses.length === 0) return []
    const state = updateTheta({ responses: competenceState.responses })

    return [
      {
        theta: state.theta,
        standardError: state.standardError,
        weight: 1,
      },
    ]
  })
  const aggregate = aggregateWeightedEstimates(competenceEstimates)
  const theta = aggregate?.theta ?? 0
  const estimatedLevel = mapMasteryThetaToLevel(theta)

  return {
    expectedLevel: expectedLevel.label,
    estimatedLevel,
    theta,
    standardError: aggregate?.standardError ?? Infinity,
    answeredQuestions: totalAnsweredQuestions,
  }
}

function buildItemPool(): SimulationItem[] {
  return Array.from({ length: COMPETENCE_COUNT }).flatMap(
    (_, competenceIndex) =>
      Array.from({ length: SUBMODULES_PER_COMPETENCE }).flatMap(
        (_, submoduleIndex) =>
          MAPPED_LEVELS.flatMap((level, levelIndex) =>
            Array.from(
              { length: ITEMS_PER_LEVEL_PER_SUBMODULE },
              (_, itemIndex) => ({
                id: `${competenceIndex}-${submoduleIndex}-${level.label}-${itemIndex}`,
                type: 'FREE_TEXT' as const,
                a: DISCRIMINATION,
                b: level.theta,
                c: deriveGuessingParameter({ type: 'FREE_TEXT' }),
                competenceId: String(competenceIndex),
                subCompetenceId: String(submoduleIndex),
                levelLabel: level.label,
                competenceIndex,
                submoduleIndex,
                levelIndex,
              })
            )
          )
      )
  )
}

function simulateAnswer({
  itemLevelIndex,
  expectedLevelIndex,
  random,
}: {
  itemLevelIndex: number
  expectedLevelIndex: number
  random: () => number
}) {
  const expectedCorrect = itemLevelIndex <= expectedLevelIndex
  const unexpected = random() < UNEXPECTED_RESPONSE_PROBABILITY

  return unexpected ? !expectedCorrect : expectedCorrect
}

function allCompetencesStopped(
  competenceStates: CompetenceState[],
  itemPool: SimulationItem[],
  answeredItemIds: Set<string>
) {
  return competenceStates.every((competenceState, competenceIndex) =>
    isCompetenceStopped({
      competenceState,
      itemPool,
      answeredItemIds,
      competenceIndex,
    })
  )
}

function isCompetenceStopped({
  competenceState,
  itemPool,
  answeredItemIds,
  competenceIndex,
}: {
  competenceState: CompetenceState
  itemPool: SimulationItem[]
  answeredItemIds: Set<string>
  competenceIndex: number
}) {
  return competenceState.submodules.every((submodule, submoduleIndex) => {
    if (submodule.stopped) return true

    return (
      submodule.responses.length >= SUBMODULE_ITEM_CAP ||
      remainingLevelCoverage({
        itemPool,
        answeredItemIds,
        competenceIndex,
        submoduleIndex,
      }) === 0
    )
  })
}

function remainingLevelCoverage({
  itemPool,
  answeredItemIds,
  competenceIndex,
  submoduleIndex,
}: {
  itemPool: SimulationItem[]
  answeredItemIds: Set<string>
  competenceIndex: number
  submoduleIndex: number
}) {
  return new Set(
    itemPool
      .filter(
        (item) =>
          item.competenceIndex === competenceIndex &&
          item.submoduleIndex === submoduleIndex &&
          !answeredItemIds.has(String(item.id))
      )
      .map((item) => item.levelLabel)
  ).size
}

function competenceTheta(competenceState: CompetenceState) {
  if (competenceState.responses.length === 0) return 0
  return updateTheta({ responses: competenceState.responses }).theta
}

function levelIndex(label: string) {
  const index = LEVELS.findIndex((level) => level.label === label)
  return index >= 0 ? index : 0
}

function mapMasteryThetaToLevel(theta: number) {
  const nextLevel = MAPPED_LEVELS.find((level, index) => {
    if (index === 0) return false
    return theta < level.theta
  })
  const levelIndex = Math.max(0, (nextLevel?.order ?? LEVELS.length) - 1)

  return LEVELS[levelIndex]!.label
}

function mulberry32(seed: number) {
  return function random() {
    let value = (seed += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
