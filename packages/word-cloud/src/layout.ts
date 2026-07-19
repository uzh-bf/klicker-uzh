import { scaleLinear, scaleLog, scaleSqrt } from 'd3-scale'
import { createRandomGenerator } from './random'
import type {
  ComputeWordCloudLayoutOptions,
  FontDescriptor,
  LayoutResult,
  LayoutSettings,
  LayoutWord,
  MeasuredWord,
  WordCloudScale,
  WordCloudWord,
} from './types'

interface PreparedWord extends WordCloudWord {
  index: number
  text: string
  value: number
}

interface PreparedPlacement {
  word: LayoutWord
  halfWidth: number
  halfHeight: number
}

interface NormalizedOptions extends LayoutSettings {
  width: number
  height: number
  measureText?: (text: string, font: FontDescriptor) => MeasuredWord
}

const DEFAULT_MIN_FONT_SIZE = 16
const DEFAULT_MAX_FONT_SIZE = 48
const DEFAULT_SCALE: WordCloudScale = 'log'
const DEFAULT_PADDING = 5
const DEFAULT_ROTATION_ANGLES: [number, number] = [0, -90]
const DEFAULT_ROTATIONS = 2
const DEFAULT_FONT_FAMILY = 'Arial'
const DEFAULT_FONT_STYLE = 'normal'
const DEFAULT_FONT_WEIGHT = 'normal'
const DEFAULT_SEED = '42'
const DEFAULT_SHRINK_FACTOR = 0.95
const DEFAULT_MAX_RELAYOUTS = 10
const DEFAULT_MAX_ATTEMPTS_PER_WORD = 1500
const DEFAULT_SPIRAL_STEP = 0.35
const DEFAULT_SPIRAL_RADIUS = 2.5

let measurementContext: CanvasRenderingContext2D | null | undefined

function getMeasurementContext() {
  if (typeof measurementContext !== 'undefined') {
    return measurementContext
  }

  if (typeof document === 'undefined') {
    measurementContext = null
    return measurementContext
  }

  const canvas = document.createElement('canvas')
  measurementContext = canvas.getContext('2d')
  return measurementContext
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function normalizeOptions(
  options: ComputeWordCloudLayoutOptions
): NormalizedOptions {
  const width = Math.max(0, Math.floor(options.width))
  const height = Math.max(0, Math.floor(options.height))
  const minFontSize = Math.max(
    1,
    typeof options.minFontSize === 'number' &&
      Number.isFinite(options.minFontSize)
      ? options.minFontSize
      : DEFAULT_MIN_FONT_SIZE
  )
  const rawMaxFontSize =
    typeof options.maxFontSize === 'number' &&
    Number.isFinite(options.maxFontSize)
      ? options.maxFontSize
      : DEFAULT_MAX_FONT_SIZE
  const maxFontSize = Math.max(minFontSize, rawMaxFontSize)
  const scale = options.scale ?? DEFAULT_SCALE
  const spiral = options.spiral ?? 'archimedean'
  const padding =
    typeof options.padding === 'number' && Number.isFinite(options.padding)
      ? Math.max(0, options.padding)
      : DEFAULT_PADDING
  const rotationAngles = options.rotationAngles ?? DEFAULT_ROTATION_ANGLES
  const rotations =
    typeof options.rotations === 'number' && Number.isFinite(options.rotations)
      ? Math.max(1, Math.floor(options.rotations))
      : DEFAULT_ROTATIONS
  const deterministic = options.deterministic ?? true
  const seed = options.seed ?? DEFAULT_SEED
  const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY
  const fontStyle = options.fontStyle ?? DEFAULT_FONT_STYLE
  const fontWeight = options.fontWeight ?? DEFAULT_FONT_WEIGHT
  const shrinkFactor =
    typeof options.shrinkFactor === 'number' &&
    Number.isFinite(options.shrinkFactor)
      ? clampNumber(options.shrinkFactor, 0.5, 0.99)
      : DEFAULT_SHRINK_FACTOR
  const maxRelayouts =
    typeof options.maxRelayouts === 'number' &&
    Number.isFinite(options.maxRelayouts)
      ? Math.max(0, Math.floor(options.maxRelayouts))
      : DEFAULT_MAX_RELAYOUTS
  const maxAttemptsPerWord =
    typeof options.maxAttemptsPerWord === 'number' &&
    Number.isFinite(options.maxAttemptsPerWord)
      ? Math.max(1, Math.floor(options.maxAttemptsPerWord))
      : DEFAULT_MAX_ATTEMPTS_PER_WORD

  return {
    width,
    height,
    minFontSize,
    maxFontSize,
    scale,
    spiral,
    padding,
    rotationAngles,
    rotations,
    deterministic,
    seed,
    fontFamily,
    fontStyle,
    fontWeight,
    shrinkFactor,
    maxRelayouts,
    maxAttemptsPerWord,
    measureText: options.measureText,
  }
}

function sanitizeInput(words: WordCloudWord[]) {
  return words
    .map((word, index) => ({
      ...word,
      index,
      text: String(word.text ?? '').trim(),
      value: Number(word.value),
    }))
    .filter((word): word is PreparedWord => {
      return (
        word.text.length > 0 && Number.isFinite(word.value) && word.value > 0
      )
    })
    .sort((left, right) => right.value - left.value)
}

function buildSettings(options: NormalizedOptions): LayoutSettings {
  return {
    minFontSize: options.minFontSize,
    maxFontSize: options.maxFontSize,
    scale: options.scale,
    spiral: options.spiral,
    padding: options.padding,
    rotationAngles: options.rotationAngles,
    rotations: options.rotations,
    deterministic: options.deterministic,
    seed: options.seed,
    fontFamily: options.fontFamily,
    fontStyle: options.fontStyle,
    fontWeight: options.fontWeight,
    shrinkFactor: options.shrinkFactor,
    maxRelayouts: options.maxRelayouts,
    maxAttemptsPerWord: options.maxAttemptsPerWord,
  }
}

function fallbackMeasureText(text: string, fontSize: number) {
  return {
    width: Math.max(1, text.length * fontSize * 0.6),
    height: Math.max(1, fontSize),
  }
}

function measureWord(
  text: string,
  font: FontDescriptor,
  customMeasureText?: (text: string, font: FontDescriptor) => MeasuredWord
) {
  const measurement = customMeasureText
    ? customMeasureText(text, font)
    : (() => {
        const context = getMeasurementContext()

        if (!context) {
          return fallbackMeasureText(text, font.size)
        }

        context.font = `${font.style} ${font.weight} ${font.size}px ${font.family}`
        const metrics = context.measureText(text)
        const fallback = fallbackMeasureText(text, font.size)
        const rawWidth = metrics.width || fallback.width
        // actualBoundingBoxAscent/Descent often underestimates line height.
        // Use fontBoundingBox values when available (more reliable), otherwise
        // fall back to em-square approximation (fontSize * 1.2) which is more
        // conservative than the tight glyph bounds.
        const boundingHeight =
          (metrics.fontBoundingBoxAscent ?? 0) +
          (metrics.fontBoundingBoxDescent ?? 0)
        const glyphHeight =
          (metrics.actualBoundingBoxAscent ?? 0) +
          (metrics.actualBoundingBoxDescent ?? 0)
        const rawHeight =
          Math.max(boundingHeight, glyphHeight) || font.size * 1.2

        return {
          width: rawWidth,
          height: rawHeight,
        }
      })()
  const radians = (Math.abs(font.rotate) * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))

  return {
    width: Math.max(1, measurement.width * cosine + measurement.height * sine),
    height: Math.max(1, measurement.width * sine + measurement.height * cosine),
  }
}

function createFontSizeAccessor(
  words: PreparedWord[],
  minimum: number,
  maximum: number,
  scaleMode: WordCloudScale
) {
  if (words.length === 0) {
    return () => minimum
  }

  const values = words.map((word) => word.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (minValue === maxValue) {
    return () => maximum
  }

  if (scaleMode === 'linear') {
    const linearScale = scaleLinear<number, number>()
      .domain([minValue, maxValue])
      .range([minimum, maximum])
    return (value: number) => clampNumber(linearScale(value), minimum, maximum)
  }

  if (scaleMode === 'sqrt') {
    const sqrtScale = scaleSqrt<number, number>()
      .domain([minValue, maxValue])
      .range([minimum, maximum])
    return (value: number) => clampNumber(sqrtScale(value), minimum, maximum)
  }

  const positiveMinValue = Math.max(minValue, 1e-6)
  const positiveMaxValue = Math.max(maxValue, positiveMinValue * 1.000001)
  const logScale = scaleLog<number, number>()
    .domain([positiveMinValue, positiveMaxValue])
    .range([minimum, maximum])

  return (value: number) => {
    const safeValue = Math.max(value, positiveMinValue)
    return clampNumber(logScale(safeValue), minimum, maximum)
  }
}

function pickRotation(
  totalWords: number,
  rotations: number,
  rotationAngles: [number, number],
  random: () => number
) {
  if (totalWords <= 1) {
    return 0
  }

  const [angleStart, angleEnd] = rotationAngles
  if (rotations <= 1) {
    return angleStart
  }

  const step = (angleEnd - angleStart) / (rotations - 1)
  const bucket = Math.min(rotations - 1, Math.floor(random() * rotations))
  return angleStart + step * bucket
}

function toPublicWord(word: PreparedWord): WordCloudWord {
  const { index: _index, ...rest } = word
  return rest
}

function intersects(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  placedWord: PreparedPlacement
) {
  return (
    Math.abs(x - placedWord.word.x) <= halfWidth + placedWord.halfWidth &&
    Math.abs(y - placedWord.word.y) <= halfHeight + placedWord.halfHeight
  )
}

function isInBounds(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  width: number,
  height: number
) {
  const halfContainerWidth = width / 2
  const halfContainerHeight = height / 2

  return (
    x - halfWidth >= -halfContainerWidth &&
    x + halfWidth <= halfContainerWidth &&
    y - halfHeight >= -halfContainerHeight &&
    y + halfHeight <= halfContainerHeight
  )
}

function archimedeanSpiral(step: number): [number, number] {
  const angle = step * DEFAULT_SPIRAL_STEP
  const radius = DEFAULT_SPIRAL_RADIUS * angle
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

function layoutSinglePass(
  words: PreparedWord[],
  options: NormalizedOptions,
  minimumFontSize: number,
  maximumFontSize: number
) {
  const random = createRandomGenerator({
    deterministic: options.deterministic,
    seed: options.seed,
  })
  const fontSizeAccessor = createFontSizeAccessor(
    words,
    minimumFontSize,
    maximumFontSize,
    options.scale
  )
  const placedWords: PreparedPlacement[] = []
  const omittedWords: WordCloudWord[] = []
  const totalWords = words.length

  for (const candidateWord of words) {
    const rotate = pickRotation(
      totalWords,
      options.rotations,
      options.rotationAngles,
      random
    )
    const fontSize = fontSizeAccessor(candidateWord.value)
    const measured = measureWord(
      candidateWord.text,
      {
        size: fontSize,
        family: options.fontFamily,
        style: options.fontStyle,
        weight: options.fontWeight,
        rotate,
      },
      options.measureText
    )
    const halfWidth = measured.width / 2 + options.padding
    const halfHeight = measured.height / 2 + options.padding

    if (halfWidth * 2 > options.width || halfHeight * 2 > options.height) {
      omittedWords.push(toPublicWord(candidateWord))
      continue
    }

    const direction = random() < 0.5 ? -1 : 1
    let wasPlaced = false

    for (
      let attempt = 0;
      attempt < options.maxAttemptsPerWord && !wasPlaced;
      attempt += 1
    ) {
      const [spiralX, spiralY] = archimedeanSpiral(attempt)
      const x = spiralX * direction
      const y = spiralY

      if (
        !isInBounds(x, y, halfWidth, halfHeight, options.width, options.height)
      ) {
        continue
      }

      const hasCollision = placedWords.some((placedWord) =>
        intersects(x, y, halfWidth, halfHeight, placedWord)
      )

      if (hasCollision) {
        continue
      }

      const layoutWord: LayoutWord = {
        ...candidateWord,
        x,
        y,
        width: measured.width,
        height: measured.height,
        fontSize,
        rotate,
        padding: options.padding,
      }
      placedWords.push({
        word: layoutWord,
        halfWidth,
        halfHeight,
      })
      wasPlaced = true
    }

    if (!wasPlaced) {
      omittedWords.push(toPublicWord(candidateWord))
    }
  }

  return {
    placedWords: placedWords.map((entry) => entry.word),
    omittedWords,
  }
}

export function computeWordCloudLayout(
  words: WordCloudWord[],
  options: ComputeWordCloudLayoutOptions
): LayoutResult {
  const normalizedOptions = normalizeOptions(options)
  const settings = buildSettings(normalizedOptions)
  const preparedWords = sanitizeInput(words)

  if (normalizedOptions.width === 0 || normalizedOptions.height === 0) {
    return {
      width: normalizedOptions.width,
      height: normalizedOptions.height,
      inputCount: words.length,
      placed: [],
      omitted: preparedWords.map((word) => toPublicWord(word)),
      relayoutCount: 0,
      settings,
    }
  }

  let relayoutCount = 0
  let currentMinFontSize = normalizedOptions.minFontSize
  let currentMaxFontSize = normalizedOptions.maxFontSize
  let placed: LayoutWord[] = []
  let omitted: WordCloudWord[] = preparedWords.map((word) => toPublicWord(word))

  while (relayoutCount <= normalizedOptions.maxRelayouts) {
    const passResult = layoutSinglePass(
      preparedWords,
      normalizedOptions,
      currentMinFontSize,
      currentMaxFontSize
    )
    placed = passResult.placedWords
    omitted = passResult.omittedWords

    if (
      omitted.length === 0 ||
      relayoutCount === normalizedOptions.maxRelayouts
    ) {
      break
    }

    relayoutCount += 1
    currentMinFontSize = Math.max(
      1,
      currentMinFontSize * normalizedOptions.shrinkFactor
    )
    currentMaxFontSize = Math.max(
      currentMinFontSize,
      currentMaxFontSize * normalizedOptions.shrinkFactor
    )
  }

  return {
    width: normalizedOptions.width,
    height: normalizedOptions.height,
    inputCount: words.length,
    placed,
    omitted,
    relayoutCount,
    settings: {
      ...settings,
      minFontSize: currentMinFontSize,
      maxFontSize: currentMaxFontSize,
    },
  }
}
