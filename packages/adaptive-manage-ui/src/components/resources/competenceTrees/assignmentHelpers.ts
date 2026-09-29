import { mapLevelsToTheta } from '@klicker-uzh/adaptive-contract'
import { AdaptiveNodeKind } from '@klicker-uzh/graphql/dist/ops'
import type { CompetenceTreeForm } from './types'

export function getAssignmentLeaves(form: CompetenceTreeForm) {
  return form.nodes.filter(
    (node) =>
      node.kind === AdaptiveNodeKind.Subcompetence &&
      !form.nodes.some((child) => child.parentKey === node.key)
  )
}

export function hasUnmappedElements(form: CompetenceTreeForm) {
  const leaves = new Set(getAssignmentLeaves(form).map((node) => node.key))
  const levels = new Set(form.levels.map((level) => level.key))
  return form.assignments.some(
    (item) =>
      !leaves.has(item.leafKey) ||
      item.additionalLeafKeys.some((leafKey) => !leaves.has(leafKey)) ||
      !levels.has(item.levelKey)
  )
}

export function assignmentHasLeaf(
  assignment: CompetenceTreeForm['assignments'][number],
  leafKey: string
) {
  return (
    assignment.leafKey === leafKey ||
    assignment.additionalLeafKeys.includes(leafKey)
  )
}

export function updateElementMapping(
  form: CompetenceTreeForm,
  key: string,
  patch: Partial<{
    leafKey: string
    additionalLeafKeys: string[]
    levelKey: string
  }>
): CompetenceTreeForm {
  const assignments = form.assignments.map((item) => {
    if (item.key !== key) return item
    const updated = {
      ...item,
      ...patch,
      additionalLeafKeys: Array.from(
        new Set(
          (patch.additionalLeafKeys ?? item.additionalLeafKeys).filter(
            (leafKey) => leafKey !== (patch.leafKey ?? item.leafKey)
          )
        )
      ),
    }
    const level = form.levels.find((level) => level.key === updated.levelKey)
    return {
      ...updated,
      b:
        mapLevelsToTheta(
          form.levels,
          { min: form.thetaMin, max: form.thetaMax },
          form.levelMappingRule
        ).find((item) => item.order === level?.order)?.theta ?? 0,
    }
  })
  const assignment = assignments.find((item) => item.key === key)
  const leaves = new Set(getAssignmentLeaves(form).map((node) => node.key))
  const assignmentLeafKeys = assignment
    ? [assignment.leafKey, ...assignment.additionalLeafKeys]
    : []
  if (
    !assignment ||
    assignmentLeafKeys.some((leafKey) => !leaves.has(leafKey)) ||
    !form.levels.some((level) => level.key === assignment.levelKey)
  )
    return { ...form, assignments }

  const coverageTargets = new Set(
    assignmentLeafKeys.map((leafKey) => `${leafKey}:${assignment.levelKey}`)
  )
  const existingCoverageTargets = new Set(
    form.coverages.map((cell) => `${cell.leafKey}:${cell.levelKey}`)
  )
  return {
    ...form,
    assignments,
    coverages: [
      ...form.coverages.map((cell) =>
        coverageTargets.has(`${cell.leafKey}:${cell.levelKey}`)
          ? { ...cell, enabled: true }
          : cell
      ),
      ...assignmentLeafKeys
        .filter(
          (leafKey) =>
            !existingCoverageTargets.has(`${leafKey}:${assignment.levelKey}`)
        )
        .map((leafKey) => ({
          leafKey,
          levelKey: assignment.levelKey,
          enabled: true,
          targetItemCount: 5,
        })),
    ],
  }
}
