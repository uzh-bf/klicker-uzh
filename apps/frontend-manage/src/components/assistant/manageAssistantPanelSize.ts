export type ManageAssistantPanelSize = {
  height: number
  width: number
}

export type ManageAssistantPanelPreset = 'default' | 'wide' | 'max'

export const DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE: ManageAssistantPanelSize = {
  height: 672,
  width: 448,
}

const MIN_PANEL_HEIGHT = 448
const MIN_PANEL_WIDTH = 360
const VIEWPORT_MARGIN = 48
const WIDE_PANEL_SIZE: ManageAssistantPanelSize = {
  height: 768,
  width: 720,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function parseManageAssistantPanelSize(
  storedValue: string | null
): ManageAssistantPanelSize | null {
  try {
    const value: unknown = JSON.parse(storedValue ?? 'null')
    if (
      typeof value !== 'object' ||
      value === null ||
      !('height' in value) ||
      !('width' in value) ||
      typeof value.height !== 'number' ||
      typeof value.width !== 'number' ||
      !Number.isFinite(value.height) ||
      !Number.isFinite(value.width)
    ) {
      return null
    }

    return { height: value.height, width: value.width }
  } catch {
    return null
  }
}

export function clampManageAssistantPanelSize(
  size: ManageAssistantPanelSize,
  viewport: { height: number; width: number }
): ManageAssistantPanelSize {
  const maximumHeight = Math.max(0, viewport.height - VIEWPORT_MARGIN)
  const maximumWidth = Math.max(0, viewport.width - VIEWPORT_MARGIN)
  const minimumHeight = Math.min(MIN_PANEL_HEIGHT, maximumHeight)
  const minimumWidth = Math.min(MIN_PANEL_WIDTH, maximumWidth)

  return {
    height: clamp(size.height, minimumHeight, maximumHeight),
    width: clamp(size.width, minimumWidth, maximumWidth),
  }
}

export function getManageAssistantPanelPresetSize(
  preset: ManageAssistantPanelPreset,
  viewport: { height: number; width: number }
): ManageAssistantPanelSize {
  const requestedSize =
    preset === 'default'
      ? DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE
      : preset === 'wide'
        ? WIDE_PANEL_SIZE
        : { height: viewport.height, width: viewport.width }

  return clampManageAssistantPanelSize(requestedSize, viewport)
}

export function resizeManageAssistantPanelFromTopLeft({
  deltaX,
  deltaY,
  size,
  viewport,
}: {
  deltaX: number
  deltaY: number
  size: ManageAssistantPanelSize
  viewport: { height: number; width: number }
}): ManageAssistantPanelSize {
  return clampManageAssistantPanelSize(
    {
      height: size.height - deltaY,
      width: size.width - deltaX,
    },
    viewport
  )
}

export function getManageAssistantKeyboardResizeDelta(
  key: string,
  step = 16
): { deltaX: number; deltaY: number } | null {
  if (key === 'ArrowLeft') return { deltaX: -step, deltaY: 0 }
  if (key === 'ArrowRight') return { deltaX: step, deltaY: 0 }
  if (key === 'ArrowUp') return { deltaX: 0, deltaY: -step }
  if (key === 'ArrowDown') return { deltaX: 0, deltaY: step }
  return null
}
