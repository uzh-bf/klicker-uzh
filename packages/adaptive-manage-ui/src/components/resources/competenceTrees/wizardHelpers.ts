export type EditorStep = 'structure' | 'questions' | 'review'

export function getEditorStepForSection(
  sectionId: string
): EditorStep | 'settings' {
  if (
    sectionId === 'competence-tree-section-coverages' ||
    sectionId === 'competence-tree-section-settings' ||
    sectionId === 'competence-tree-section-levels'
  )
    return 'settings'
  if (sectionId === 'competence-tree-section-assignments') return 'questions'
  return 'structure'
}
