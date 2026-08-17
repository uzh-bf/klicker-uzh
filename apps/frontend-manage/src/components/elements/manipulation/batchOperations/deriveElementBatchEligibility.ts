import { type Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import type { ElementBatchOperationActions } from '../types'

export type ElementBatchAffectedElement = Element & {
  actionsApplied: boolean
  reasons: string[]
  sharingApplied: boolean
  sharingReasons: string[]
}

type EligibilityMessages = {
  unarchiveOnlyArchived: string
  unarchiveOnlyManager: string
  archiveOnlyUnarchived: string
  archiveOnlyManager: string
  multiplierOnlySampleSolution: string
  multiplierOnlyEditor: string
  basePointsOnlyQuestions: string
  basePointsOnlyEditor: string
  sharingInsufficientPermission: string
}

export function deriveElementBatchEligibility({
  elements,
  selectedActions,
  messages,
}: {
  elements: Element[]
  selectedActions: ElementBatchOperationActions
  messages: EligibilityMessages
}): ElementBatchAffectedElement[] {
  return elements.map((element) => {
    let actionsApplied = true
    const reasons: string[] = []

    if (selectedActions.unarchive) {
      if (!element.isArchived) {
        actionsApplied = false
        reasons.push(messages.unarchiveOnlyArchived)
      }
      if (element.isArchived && !element.isManager) {
        actionsApplied = false
        reasons.push(messages.unarchiveOnlyManager)
      }
    } else if (selectedActions.archive) {
      if (element.isArchived) {
        actionsApplied = false
        reasons.push(messages.archiveOnlyUnarchived)
      }
      if (!element.isManager) {
        actionsApplied = false
        reasons.push(messages.archiveOnlyManager)
      }
    }

    if (selectedActions.multiplier) {
      if (!('options' in element && element.options.hasSampleSolution)) {
        actionsApplied = false
        reasons.push(messages.multiplierOnlySampleSolution)
      }
      if (!element.isEditor) {
        actionsApplied = false
        reasons.push(messages.multiplierOnlyEditor)
      }
    }

    if (typeof selectedActions.basePoints !== 'undefined') {
      if (
        element.type === ElementType.Flashcard ||
        element.type === ElementType.Content
      ) {
        actionsApplied = false
        reasons.push(messages.basePointsOnlyQuestions)
      }
      if (!element.isEditor) {
        actionsApplied = false
        reasons.push(messages.basePointsOnlyEditor)
      }
    }

    return {
      ...element,
      actionsApplied,
      reasons,
      sharingApplied: element.isManager === true,
      sharingReasons: element.isManager
        ? []
        : [messages.sharingInsufficientPermission],
    }
  })
}
