import {
  Choice,
  InstanceResults,
  NumericalRestrictions,
  NumericalSolutionRange,
} from '@klicker-uzh/graphql/dist/ops'
import { QUESTION_GROUPS } from 'shared-components/src/constants'

type baseData = {
  blockIx: number
  instanceIx: number
  content: string
  type: string
  participants: number
  restrictions?: NumericalRestrictions // Only in NUMERICAL
  solutions?: NumericalSolutionRange[] | string[]
}

export function extractQuestions(instanceResults: InstanceResults[]) {
  if (!instanceResults) return []

  return instanceResults.map((instance) => {
    const questionType = instance.questionData.type
    const baseData: baseData = {
      blockIx: instance.blockIx,
      instanceIx: instance.instanceIx,
      content: instance.questionData.content,
      type: questionType,
      participants: instance.participants,
    }

    let answers

    if (QUESTION_GROUPS.CHOICES.includes(questionType)) {
      answers = instance.questionData.options.choices.map(
        (choice: Choice, idx: number) => ({
          value: choice.value,
          correct: choice.correct,
          count: instance.results[idx].count,
        })
      )
    } else if (questionType === 'NUMERICAL') {
      if (instance.questionData.options.restrictions) {
        baseData.restrictions = instance.questionData.options.restrictions
      } else {
        baseData.restrictions = {}
      }
      baseData.solutions = {}
      if (instance.questionData.options.solutionRanges) {
        baseData.solutions = instance.questionData.options.solutionRanges
      }
      answers = Object.values(instance.results).map((answer) => ({
        value: answer.value,
        count: answer.count,
      }))
    } else if (instance.questionData.type === 'FREE_TEXT') {
      baseData.solutions = {}
      if (instance.questionData.options.solutions) {
        baseData.solutions = instance.questionData.options.solutions
      }
      answers = Object.values(instance.results).map((answer) => ({
        value: answer.value,
        count: answer.count,
      }))
    }

    return {
      ...baseData,
      answers,
    }
  })
}
