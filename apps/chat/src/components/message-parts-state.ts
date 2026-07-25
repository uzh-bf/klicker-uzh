export function resolveDisclosureOpen(
  manualOpen: boolean | null,
  autoOpen: boolean,
  active: boolean
) {
  return manualOpen ?? (autoOpen && active)
}
