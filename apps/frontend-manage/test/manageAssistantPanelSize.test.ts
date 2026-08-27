import assert from 'node:assert/strict'
import {
  clampManageAssistantPanelSize,
  getManageAssistantKeyboardResizeDelta,
  parseManageAssistantPanelSize,
  resizeManageAssistantPanelFromTopLeft,
} from '../src/components/assistant/manageAssistantPanelSize'

assert.deepEqual(parseManageAssistantPanelSize('{"height":600,"width":500}'), {
  height: 600,
  width: 500,
})
assert.equal(parseManageAssistantPanelSize('{not-json'), null)
assert.equal(
  parseManageAssistantPanelSize('{"height":"600","width":500}'),
  null
)
assert.equal(parseManageAssistantPanelSize('{"height":null,"width":500}'), null)

assert.deepEqual(
  clampManageAssistantPanelSize(
    { height: 2_000, width: 2_000 },
    { height: 800, width: 1_200 }
  ),
  { height: 752, width: 720 }
)

assert.deepEqual(
  clampManageAssistantPanelSize(
    { height: 100, width: 100 },
    { height: 800, width: 1_200 }
  ),
  { height: 448, width: 360 }
)

assert.deepEqual(
  resizeManageAssistantPanelFromTopLeft({
    deltaX: -32,
    deltaY: -48,
    size: { height: 600, width: 400 },
    viewport: { height: 900, width: 1_400 },
  }),
  { height: 648, width: 432 }
)

assert.deepEqual(getManageAssistantKeyboardResizeDelta('ArrowLeft'), {
  deltaX: -16,
  deltaY: 0,
})
assert.deepEqual(getManageAssistantKeyboardResizeDelta('ArrowDown', 32), {
  deltaX: 0,
  deltaY: 32,
})
assert.equal(getManageAssistantKeyboardResizeDelta('Enter'), null)
