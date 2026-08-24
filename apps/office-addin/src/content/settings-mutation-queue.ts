export type SettingsMutationResult = 'saved' | 'rolled-back' | 'rollback-failed'

type SettingsMutation = () => void

export function createSettingsMutationQueue(
  saveSettings: () => Promise<boolean>
): (
  mutate: SettingsMutation,
  rollback: SettingsMutation
) => Promise<SettingsMutationResult> {
  let queue = Promise.resolve()

  return function persistSettingsMutation(
    mutate: SettingsMutation,
    rollback: SettingsMutation
  ): Promise<SettingsMutationResult> {
    const operation = queue.then(async () => {
      mutate()
      if (await saveSettings()) {
        return 'saved'
      }

      rollback()
      return (await saveSettings()) ? 'rolled-back' : 'rollback-failed'
    })

    queue = operation.then(
      () => undefined,
      () => undefined
    )

    return operation
  }
}
