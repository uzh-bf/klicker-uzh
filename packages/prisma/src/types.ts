export type AvatarSettingsPrisma = {
  skinTone: string
  eyes: string
  mouth: string
  hair: string
  accessory: string
  hairColor: string
  clothing: string
  clothingColor: string
  facialHair: string
}

export type QuestionResponseChoicesPrisma = {
  choices: number[]
}

export type QuestionResponseValuePrisma = {
  value: string
}

export type QuestionResponsePrisma =
  | QuestionResponseChoicesPrisma
  | QuestionResponseValuePrisma

declare global {
  namespace PrismaJson {
    type AvatarSettings = AvatarSettingsPrisma
    type QuestionResponse = QuestionResponsePrisma
  }
}
