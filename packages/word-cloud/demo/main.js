import { computeWordCloudLayout, renderWordCloud } from '/dist/index.js'

const cloudElement = document.getElementById('cloud')
const statsElement = document.getElementById('stats')
const emptyStateElement = document.getElementById('empty-state')
const renderButton = document.getElementById('render')
const shuffleButton = document.getElementById('shuffle')
const clearButton = document.getElementById('clear')
const inputs = {
  seed: document.getElementById('seed'),
  scale: document.getElementById('scale'),
  width: document.getElementById('width'),
  height: document.getElementById('height'),
  minFontSize: document.getElementById('minFontSize'),
  maxFontSize: document.getElementById('maxFontSize'),
  rotations: document.getElementById('rotations'),
}

const sampleWords = [
  { text: 'alpha', value: 42 },
  { text: 'beta', value: 33 },
  { text: 'gamma', value: 29 },
  { text: 'delta', value: 27 },
  { text: 'epsilon', value: 24 },
  { text: 'zeta', value: 21 },
  { text: 'eta', value: 18 },
  { text: 'theta', value: 17 },
  { text: 'iota', value: 15 },
  { text: 'kappa', value: 14 },
  { text: 'lambda', value: 13 },
  { text: 'mu', value: 12 },
  { text: 'nu', value: 11 },
  { text: 'xi', value: 10 },
  { text: 'omicron', value: 9 },
  { text: 'pi', value: 8 },
  { text: 'rho', value: 7 },
  { text: 'sigma', value: 6 },
  { text: 'tau', value: 5 },
  { text: 'upsilon', value: 4 },
  { text: 'phi', value: 3 },
  { text: 'chi', value: 2 },
  { text: 'psi', value: 2 },
  { text: 'omega', value: 1 },
]

let words = [...sampleWords]
let renderer = null

function readNumberInput(element, fallback) {
  const parsed = Number(element.value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function shuffleWeights() {
  if (words.length === 0) {
    words = [...sampleWords]
  }
  words = words.map((word) => ({
    ...word,
    value: Math.max(1, Math.floor(Math.random() * 60)),
  }))
}

function setEmptyState(visible) {
  if (!emptyStateElement) {
    return
  }
  emptyStateElement.classList.toggle('visible', visible)
}

function renderCloud() {
  const width = Math.max(180, Math.floor(readNumberInput(inputs.width, 860)))
  const height = Math.max(180, Math.floor(readNumberInput(inputs.height, 620)))
  const minFontSize = Math.max(
    1,
    Math.floor(readNumberInput(inputs.minFontSize, 16))
  )
  const maxFontSize = Math.max(
    minFontSize,
    Math.floor(readNumberInput(inputs.maxFontSize, 48))
  )
  const rotations = Math.max(
    1,
    Math.floor(readNumberInput(inputs.rotations, 2))
  )

  cloudElement.style.width = `${width}px`
  cloudElement.style.height = `${height}px`

  const layoutResult = computeWordCloudLayout(words, {
    width,
    height,
    minFontSize,
    maxFontSize,
    scale: inputs.scale.value,
    deterministic: true,
    seed: inputs.seed.value || '42',
    rotations,
    rotationAngles: [0, -90],
    padding: 5,
  })

  const getWordTooltip = (word) => {
    const wrapper = document.createElement('div')
    const label = document.createElement('strong')
    label.textContent = word.text
    const value = document.createTextNode(`Frequency: ${word.value}`)
    wrapper.append(label, document.createElement('br'), value)
    return wrapper
  }

  if (!renderer) {
    renderer = renderWordCloud(cloudElement, layoutResult, {
      transitionDuration: 350,
      getWordTooltip,
    })
  } else {
    renderer.update(layoutResult, { getWordTooltip })
  }

  setEmptyState(
    layoutResult.inputCount === 0 || layoutResult.placed.length === 0
  )
  statsElement.textContent = `Placed ${layoutResult.placed.length}/${layoutResult.inputCount} words. Relayout passes: ${layoutResult.relayoutCount}.`
}

renderButton.addEventListener('click', renderCloud)
shuffleButton.addEventListener('click', () => {
  shuffleWeights()
  renderCloud()
})
clearButton.addEventListener('click', () => {
  words = []
  renderCloud()
})

renderCloud()
