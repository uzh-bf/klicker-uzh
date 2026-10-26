import {
  type AdaptiveItemType,
  deriveGuessingParameter,
  mapLevelsToTheta,
} from '@klicker-uzh/adaptive-contract'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { getAssignmentLeaves } from './assignmentHelpers'
import type { CompetenceTreeForm } from './types'

export const ASSIGNABLE_TYPES = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
]
export interface LibraryAssignmentElement {
  id: number
  name: string
  type: ElementType
  version: number
  choiceCount: number | null
}

// Existing mappings are never replaced when adding a batch from the library.
export function addElementBatch(
  form: CompetenceTreeForm,
  elements: LibraryAssignmentElement[],
  leafKey: string,
  levelKey: string
): CompetenceTreeForm {
  const level = form.levels.find((entry) => entry.key === levelKey)
  if (!level || !getAssignmentLeaves(form).some((leaf) => leaf.key === leafKey))
    return form
  const existing = new Set(form.assignments.map((entry) => entry.elementId))
  const b =
    mapLevelsToTheta(
      form.levels,
      { min: form.thetaMin, max: form.thetaMax },
      form.levelMappingRule
    ).find((entry) => entry.order === level.order)?.theta ?? 0
  const additions = elements
    .filter((element) => {
      if (existing.has(element.id) || !ASSIGNABLE_TYPES.includes(element.type))
        return false
      existing.add(element.id)
      return true
    })
    .map((element) => ({
      key: `assignment:local:${element.id}`,
      sourceId: -element.id,
      elementId: element.id,
      elementName: element.name,
      elementType: element.type,
      elementVersion: element.version,
      leafKey,
      additionalLeafKeys: [],
      levelKey,
      enabled: true,
      discrimination: null,
      enablePercentInput: false,
      choiceCount: element.choiceCount,
      a: form.defaultDiscrimination,
      b,
      c: deriveGuessingParameter({
        type: element.type as AdaptiveItemType,
        choiceCount: element.choiceCount,
      }),
    }))
  if (additions.length === 0) return form
  const hasCoverage = form.coverages.some(
    (cell) => cell.leafKey === leafKey && cell.levelKey === levelKey
  )
  return {
    ...form,
    assignments: [...form.assignments, ...additions],
    coverages: [
      ...form.coverages.map((cell) =>
        cell.leafKey === leafKey && cell.levelKey === levelKey
          ? { ...cell, enabled: true }
          : cell
      ),
      ...(!hasCoverage
        ? [{ leafKey, levelKey, enabled: true, targetItemCount: 5 }]
        : []),
    ],
  }
}
