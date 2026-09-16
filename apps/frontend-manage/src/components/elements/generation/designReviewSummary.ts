// Design-review view models for the generation gate. Kept dependency-free so
// the component's rendering branches and the concentration check can be tested
// without a GraphQL client runtime.

// A synthesized Bloom-level objective carries objectiveSource 'neutral';
// builds persisted before that marker have no value and stay treated as
// lecturer guidance, so only an explicit 'neutral' shows the generated-default
// label.
export type ElementGenerationDesignObjectiveView = {
  id: string
  text: string
  bloomLevel: string | null
  isGeneratedDefault: boolean
}

export function designReviewObjectives(
  objectives: ReadonlyArray<{
    id: string
    text: string
    bloomLevel: string | null
    objectiveSource?: string | null
  }>
): ElementGenerationDesignObjectiveView[] {
  return objectives.map((objective) => ({
    id: objective.id,
    text: objective.text,
    bloomLevel: objective.bloomLevel,
    isGeneratedDefault: objective.objectiveSource === 'neutral',
  }))
}

export type ElementGenerationDesignSlotEvidenceView = {
  sourceElementId: string
  moduleId: string
  entityIds: string[]
}

export type ElementGenerationDesignConcentrationView = {
  moduleId: string
  entityIds: string[]
  slotCount: number
}

// Slots without surfaced entities render nothing extra, so older worker
// artifacts stay valid.
export function designReviewSlotEvidence(
  slots: ReadonlyArray<{
    sourceElementId: string
    moduleId: string
    evidenceEntityIds?: readonly string[] | null
  }>
): ElementGenerationDesignSlotEvidenceView[] {
  return slots.map((slot) => ({
    sourceElementId: slot.sourceElementId,
    moduleId: slot.moduleId,
    entityIds: [...(slot.evidenceEntityIds ?? [])],
  }))
}

function entityIdSetKey(entityIds: readonly string[]): string {
  return [...entityIds].sort().join('\u0000')
}

// A concentration is a module whose slots with surfaced entities all ground on
// one identical, non-empty entity set. Two or more such slots are required: a
// single slot cannot be concentrated against itself.
export function designReviewConcentration(
  slots: ReadonlyArray<ElementGenerationDesignSlotEvidenceView>
): ElementGenerationDesignConcentrationView[] {
  const byModule = new Map<string, ElementGenerationDesignSlotEvidenceView[]>()
  for (const slot of slots) {
    if (slot.entityIds.length === 0) continue
    const moduleSlots = byModule.get(slot.moduleId) ?? []
    moduleSlots.push(slot)
    byModule.set(slot.moduleId, moduleSlots)
  }

  const concentrations: ElementGenerationDesignConcentrationView[] = []
  for (const [moduleId, moduleSlots] of byModule) {
    if (moduleSlots.length < 2) continue
    const key = entityIdSetKey(moduleSlots[0]!.entityIds)
    if (moduleSlots.every((slot) => entityIdSetKey(slot.entityIds) === key)) {
      concentrations.push({
        moduleId,
        entityIds: [...moduleSlots[0]!.entityIds],
        slotCount: moduleSlots.length,
      })
    }
  }
  return concentrations
}
