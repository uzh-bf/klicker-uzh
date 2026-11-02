export type GeneratedFlashcardCardType =
  | 'definition'
  | 'formula'
  | 'calculation'

export type FlashcardGenerationLanguage = 'de' | 'en'

export type FlashcardGenerationConfiguration = {
  language: FlashcardGenerationLanguage
  flashcardCount: number
  objectives: Array<{
    id: string
    text: string
  }>
}

export type GeneratedFlashcard = {
  sourceFlashcardId: string
  name: string
  front: string
  back: string
  cardType: GeneratedFlashcardCardType
  tags: string[]
}

export type GeneratedFlashcardEditable = Pick<
  GeneratedFlashcard,
  'name' | 'front' | 'back' | 'cardType' | 'tags'
>
