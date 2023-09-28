export type AvatarSettings = {
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

export type QuestionResponse =
  | {
      choices: number[]
    }
  | {
      value: string
    }

declare global {
  namespace PrismaJson {
    type AvatarSettingsPrisma = AvatarSettings
    type QuestionResponsePrisma = QuestionResponse
  }
}
