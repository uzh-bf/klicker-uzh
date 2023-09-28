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

declare global {
  namespace PrismaJson {
    type AvatarSettingsPrisma = AvatarSettings
  }
}
