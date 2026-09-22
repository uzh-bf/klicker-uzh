interface MessageObject {
  [key: string]: MessageValue
}
type MessageValue = string | MessageObject
export type DeepMerge<
  Base extends MessageObject,
  Patch extends MessageObject,
> = {
  [Key in keyof Base | keyof Patch]: Key extends keyof Patch
    ? Key extends keyof Base
      ? Base[Key] extends MessageObject
        ? Patch[Key] extends MessageObject
          ? DeepMerge<Base[Key], Patch[Key]>
          : Patch[Key]
        : Patch[Key]
      : Patch[Key]
    : Key extends keyof Base
      ? Base[Key]
      : never
}
export function mergeAdaptiveMessages<
  Base extends MessageObject,
  Patch extends MessageObject,
>(base: Base, patch: Patch): DeepMerge<Base, Patch> {
  const result: MessageObject = { ...base }
  for (const key of Object.keys(patch)) {
    const next = patch[key]
    const prior = result[key]
    result[key] =
      typeof prior === 'object' && typeof next === 'object'
        ? mergeAdaptiveMessages(prior, next)
        : next
  }
  return result as DeepMerge<Base, Patch>
}
