export type ManageAssistantPanelSize = {
  height: number
  width: number
}

export const DEFAULT_MANAGE_ASSISTANT_PANEL_SIZE: ManageAssistantPanelSize = {
  height: 672,
  width: 448,
}

const MIN_PANEL_HEIGHT = 448
const MIN_PANEL_WIDTH = 360
const MAX_PANEL_HEIGHT = 864
const MAX_PANEL_WIDTH = 720
const VIEWPORT_MARGIN = 48

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
  const maximumHeight = Math.max(
    MIN_PANEL_HEIGHT,
    Math.min(MAX_PANEL_HEIGHT, viewport.height - VIEWPORT_MARGIN)
  )
  const maximumWidth = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, viewport.width - VIEWPORT_MARGIN)
  )

  return {
    height: clamp(size.height, MIN_PANEL_HEIGHT, maximumHeight),
    width: clamp(size.width, MIN_PANEL_WIDTH, maximumWidth),
  }
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
