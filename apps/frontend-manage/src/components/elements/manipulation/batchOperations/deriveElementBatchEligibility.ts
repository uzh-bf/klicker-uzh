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

function getActionReasons(
  element: Element,
  selectedActions: ElementBatchOperationActions,
  messages: EligibilityMessages
) {
  const reasons: string[] = []

  if (selectedActions.unarchive) {
    if (!element.isArchived) reasons.push(messages.unarchiveOnlyArchived)
    if (element.isArchived && !element.isManager) {
      reasons.push(messages.unarchiveOnlyManager)
    }
  } else if (selectedActions.archive) {
    if (element.isArchived) reasons.push(messages.archiveOnlyUnarchived)
    if (!element.isManager) reasons.push(messages.archiveOnlyManager)
  }

  if (selectedActions.multiplier) {
    if (!('options' in element && element.options.hasSampleSolution)) {
      reasons.push(messages.multiplierOnlySampleSolution)
    }
    if (!element.isEditor) reasons.push(messages.multiplierOnlyEditor)
  }

  if (typeof selectedActions.basePoints !== 'undefined') {
    if (
      element.type === ElementType.Flashcard ||
      element.type === ElementType.Content
    ) {
      reasons.push(messages.basePointsOnlyQuestions)
    }
    if (!element.isEditor) reasons.push(messages.basePointsOnlyEditor)
  }

  return reasons
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
    const reasons = getActionReasons(element, selectedActions, messages)
    return {
      ...element,
      actionsApplied: reasons.length === 0,
      reasons,
      sharingApplied: element.isManager === true,
      sharingReasons: element.isManager
        ? []
        : [messages.sharingInsufficientPermission],
    }
  })
}
