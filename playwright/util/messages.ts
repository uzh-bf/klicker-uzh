import en from '../../packages/i18n/messages/en.js'

export const enMessages = en

export const statusLabels = {
  draft: enMessages.shared.DRAFT.statusLabel as 'Draft',
  review: enMessages.shared.REVIEW.statusLabel as 'Review',
  ready: enMessages.shared.READY.statusLabel as 'Ready',
}

export const elementTypeLabels = {
  // Short labels (without abbreviation) — used by D/E specs
  content: enMessages.shared.CONTENT.typeLabel as 'Content',
  flashcard: enMessages.shared.FLASHCARD.typeLabel as 'Flashcard',
  // Full labels (with abbreviation) — used by F–L specs
  singleChoice: enMessages.shared.SC.typeLabel as 'Single Choice (SC)',
  multipleChoice: enMessages.shared.MC.typeLabel as 'Multiple Choice (MC)',
  kprim: enMessages.shared.KPRIM.typeLabel as 'Kprim (KP)',
  numerical: enMessages.shared.NUMERICAL.typeLabel as 'Numerical (NR)',
  freeText: enMessages.shared.FREE_TEXT.typeLabel as 'Free Text (FT)',
  selection: enMessages.shared.SELECTION.typeLabel as 'Selection (SE)',
  caseStudy: enMessages.shared.CASE_STUDY.typeLabel as 'Case Study (CS)',
}

export type EnMessages = typeof enMessages
