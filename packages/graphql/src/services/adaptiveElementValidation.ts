import {
  DEFAULT_DISCRIMINATION,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
  deriveGuessingParameter,
  normalizeFreeTextResponse,
  type AdaptiveItemType,
} from '@klicker-uzh/adaptive-learning'
import { GraphQLError } from 'graphql'

export function getAdaptiveElementChoiceCount(options: unknown): number | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return null
  }
  const choices = (options as Record<string, unknown>).choices
  return Array.isArray(choices) ? choices.length : null
}

export function isSupportedAdaptiveElementType(
  type: string
): type is AdaptiveItemType {
  return SUPPORTED_ADAPTIVE_ITEM_TYPES.includes(type as AdaptiveItemType)
}

export function deriveAdaptiveItemParameters({
  type,
  choiceCount,
  levelTheta,
  discrimination,
}: {
  type: string
  choiceCount?: number | null
  levelTheta: number
  discrimination?: number | null
}) {
  if (!isSupportedAdaptiveElementType(type)) {
    throw new GraphQLError(`Element type ${type} is not adaptive-compatible.`, {
      extensions: { code: 'ADAPTIVE_ITEM_TYPE_UNSUPPORTED' },
    })
  }

  return {
    a: discrimination ?? DEFAULT_DISCRIMINATION,
    b: levelTheta,
    c: deriveGuessingParameter({ type, choiceCount }),
  }
}

export function hasControlledAdaptiveAnswer(
  type: string,
  options: unknown
): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return false
  }
  const value = options as Record<string, unknown>

  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    if (!Array.isArray(value.choices) || value.choices.length < 2) return false
    if (type === 'KPRIM' && value.choices.length !== 4) return false
    const correctness = value.choices.map((choice) =>
      choice && typeof choice === 'object' && !Array.isArray(choice)
        ? (choice as Record<string, unknown>).correct
        : undefined
    )
    if (!correctness.every((correct) => typeof correct === 'boolean')) {
      return false
    }
    const correctCount = correctness.filter(
      (correct) => correct === true
    ).length
    if (type === 'SC') return correctCount === 1
    if (type === 'MC') return correctCount >= 1
    return true
  }

  if (type === 'NUMERICAL') {
    const exactSolutions = Array.isArray(value.exactSolutions)
      ? value.exactSolutions.filter(
          (solution) =>
            typeof solution === 'number' && Number.isFinite(solution)
        )
      : []
    const ranges = Array.isArray(value.solutionRanges)
      ? value.solutionRanges.filter((range) => {
          if (!range || typeof range !== 'object' || Array.isArray(range)) {
            return false
          }
          const { min, max } = range as Record<string, unknown>
          return (
            (typeof min === 'number' && Number.isFinite(min)) ||
            (typeof max === 'number' && Number.isFinite(max))
          )
        })
      : []
    return exactSolutions.length > 0 || ranges.length > 0
  }

  if (type === 'FREE_TEXT') {
    return (
      Array.isArray(value.solutions) &&
      value.solutions.length > 0 &&
      value.solutions.every(
        (solution) =>
          typeof solution === 'string' &&
          normalizeFreeTextResponse(solution).length > 0
      )
    )
  }

  return false
}
