import { z } from 'zod'

export const singleAnswerCollectionInput = z.object({
  id: z.number().int(),
})

export const answerCollectionsForElementsInput = z.object({
  templateId: z.string().nullish(),
})

export const createAnswerCollectionInput = z.object({
  name: z.string(),
  description: z.string(),
  answers: z.array(z.string()),
})

export const answerCollectionIdInput = z.object({
  id: z.number().int(),
})

export const deleteAnswerCollectionInput = z.object({
  collectionId: z.number().int(),
})

export const modifyAnswerCollectionInput = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  description: z.string().nullish(),
})

export const answerCollectionEntryInput = z.object({
  id: z.number().int(),
  value: z.string(),
  collectionId: z.number().int(),
})

export const addAnswerCollectionOptionInput = z.object({
  collectionId: z.number().int(),
  value: z.string(),
})

export const deleteAnswerCollectionEntryInput = z.object({
  id: z.number().int(),
  collectionId: z.number().int(),
})
