export async function refreshAfterMutation(
  refresh: () => Promise<unknown>,
  context: string
) {
  try {
    await refresh()
  } catch (error) {
    console.error(`Failed to refresh ${context}`, error)
  }
}
