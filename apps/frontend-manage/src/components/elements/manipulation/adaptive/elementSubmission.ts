export function refreshElementListBestEffort(
  refetchElements: () => Promise<void>
): void {
  void refetchElements().catch(() => undefined)
}
