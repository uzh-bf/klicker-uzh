import { randomUUID } from 'node:crypto'
import type {
  ElementData,
  ElementOptionsNumerical,
  NumericalMistake,
  NumericalMistakeRange,
  NumericalNumberFormat,
  NumericalParametrization,
  NumericalVariable,
} from '@klicker-uzh/types'
import { type MathNode, parse } from 'mathjs'

// Per-attempt numbers for numerical elements. Lecturers type formulas that
// run on the server, so every formula is parsed and checked against a small
// allowlist of arithmetic before it is evaluated.

const ALLOWED_OPERATORS = new Set(['+', '-', '*', '/', '^'])
const ALLOWED_UNARY = new Set(['unaryMinus', 'unaryPlus'])
const ALLOWED_FUNCTIONS = new Set([
  'abs',
  'round',
  'floor',
  'ceil',
  'min',
  'max',
  'sqrt',
  'exp',
  'log',
  'log10',
])
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g
const VALIDATION_SAMPLES = 20

export type NumericalValues = Record<string, number>

interface CompiledFormula {
  evaluate: (scope: NumericalValues) => number
}

function checkNode(node: MathNode, symbols: ReadonlySet<string>): void {
  switch (node.type) {
    case 'ConstantNode': {
      const value = (node as unknown as { value: unknown }).value
      if (typeof value !== 'number') {
        throw new Error('Only numbers are allowed as constants')
      }
      return
    }
    case 'SymbolNode': {
      const name = (node as unknown as { name: string }).name
      if (!symbols.has(name) && !(name in CONSTANTS)) {
        throw new Error(`Unknown name "${name}"`)
      }
      return
    }
    case 'ParenthesisNode':
      checkNode((node as unknown as { content: MathNode }).content, symbols)
      return
    case 'OperatorNode': {
      const { fn, op, args } = node as unknown as {
        fn: string
        op: string
        args: MathNode[]
      }
      const allowed =
        args.length === 1 ? ALLOWED_UNARY.has(fn) : ALLOWED_OPERATORS.has(op)
      if (!allowed) throw new Error(`Operator "${op}" is not allowed`)
      for (const arg of args) checkNode(arg, symbols)
      return
    }
    case 'FunctionNode': {
      const { fn, args } = node as unknown as {
        fn: MathNode
        args: MathNode[]
      }
      const name =
        fn.type === 'SymbolNode'
          ? (fn as unknown as { name: string }).name
          : undefined
      if (!name || !ALLOWED_FUNCTIONS.has(name)) {
        throw new Error(`Function "${name ?? '?'}" is not allowed`)
      }
      for (const arg of args) checkNode(arg, symbols)
      return
    }
    default:
      throw new Error(`Expression part "${node.type}" is not allowed`)
  }
}

// Parses a formula and rejects anything outside the allowlist. Symbols must be
// declared names or the constants pi and e.
export function compileFormula(
  formula: string,
  symbols: ReadonlySet<string>
): CompiledFormula {
  if (typeof formula !== 'string' || formula.trim() === '') {
    throw new Error('Formula is empty')
  }
  const node = parse(formula)
  checkNode(node, symbols)
  const code = node.compile()
  return {
    evaluate: (scope) => {
      const result = code.evaluate({ ...CONSTANTS, ...scope })
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error(`Formula "${formula}" has no finite result`)
      }
      return result
    },
  }
}

// FNV-1a hash of a string, used as the seed of one variable's draw.
function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// mulberry32: small deterministic generator returning values in [0, 1).
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundToStep(value: number, step?: number | null): number {
  if (!step || step <= 0) return value
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1)
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

function drawVariable(variable: NumericalVariable, random: () => number) {
  const min = variable.min ?? 0
  const max = variable.max ?? min
  switch (variable.kind) {
    case 'INTEGER': {
      const value = min + Math.floor(random() * (max - min + 1))
      return value * (variable.step ?? 1)
    }
    case 'RANGE':
      return roundToStep(min + random() * (max - min), variable.step)
    case 'PICK': {
      const values = variable.values ?? []
      return values[Math.floor(random() * values.length)]!
    }
  }
}

// Draws every variable and computes the derived values for one seed source.
// Each variable draws from its own hash of `<seedSource>:<name>`, so values
// stay the same when variables are reordered.
export function computeNumericalValues(
  parametrization: NumericalParametrization,
  seedSource: string
): NumericalValues {
  const values: NumericalValues = {}
  for (const variable of parametrization.variables) {
    const random = createRandom(hashSeed(`${seedSource}:${variable.name}`))
    values[variable.name] = drawVariable(variable, random)
  }
  for (const derived of parametrization.derived ?? []) {
    values[derived.name] = compileFormula(
      derived.formula,
      new Set(Object.keys(values))
    ).evaluate(values)
  }
  return values
}

function decimalsFor(
  name: string,
  value: number,
  parametrization: NumericalParametrization
): number {
  const variable = parametrization.variables.find(
    (variable) => variable.name === name
  )
  const declared =
    variable?.decimals ??
    parametrization.derived?.find((derived) => derived.name === name)?.decimals
  if (typeof declared === 'number') return declared
  // Grading uses the drawn value itself, so a drawn variable without declared
  // decimals is shown exactly; toPrecision drops float noise such as 0.3 * 3.
  if (variable) {
    // exponent form avoids String()'s switch to e-notation for tiny values
    const [mantissa, exponent] = value.toExponential(11).split('e')
    const digits = mantissa!.split('.')[1]?.replace(/0+$/, '').length ?? 0
    return Math.min(20, Math.max(0, digits - Number(exponent)))
  }
  return Number.isInteger(value) ? 0 : 2
}

export function formatNumericalValue(
  value: number,
  decimals: number,
  format: NumericalNumberFormat = 'APOSTROPHE'
): string {
  const [whole, fraction] = Math.abs(value).toFixed(decimals).split('.')
  const separator = format === 'COMMA' ? ',' : "'"
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  const sign = value < 0 && Number(whole) + Number(fraction ?? 0) > 0 ? '-' : ''
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`
}

export function renderNumericalTemplate(
  text: string,
  values: NumericalValues,
  parametrization: NumericalParametrization
): string {
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const value = values[name]
    if (typeof value !== 'number') return match
    return formatNumericalValue(
      value,
      decimalsFor(name, value, parametrization),
      parametrization.numberFormat ?? 'APOSTROPHE'
    )
  })
}

function overlaps(a: { min: number; max: number }, b: NumericalMistakeRange) {
  return a.min <= b.max && b.min <= a.max
}

// Computes the concrete mistake ranges for one set of values. A mistake whose
// range overlaps a solution range is dropped, so a correct answer never
// counts as a mistake.
export function computeMistakeRanges(
  mistakes: readonly NumericalMistake[],
  values: NumericalValues,
  solutionRanges: readonly { min?: number | null; max?: number | null }[]
): NumericalMistakeRange[] {
  const symbols = new Set(Object.keys(values))
  const solutions = solutionRanges.map(({ min, max }) => ({
    min: typeof min === 'number' ? min : -Infinity,
    max: typeof max === 'number' ? max : Infinity,
  }))
  return mistakes.flatMap((mistake) => {
    const value = compileFormula(mistake.formula, symbols).evaluate(values)
    const range = {
      key: mistake.key,
      min: value - mistake.tolerance,
      max: value + mistake.tolerance,
    }
    return solutions.some((solution) => overlaps(solution, range))
      ? []
      : [range]
  })
}

interface RenderableNumericalData {
  content: string
  explanation?: string | null
  options: ElementOptionsNumerical
}

export function isParametrizedNumerical(
  options: ElementOptionsNumerical | null | undefined
): boolean {
  return !!options?.parametrization?.variables?.length
}

export function hasNumericalMistakes(
  options: ElementOptionsNumerical | null | undefined
): boolean {
  return !!options?.mistakes?.length
}

// Renders a numerical element's data for one seed source: placeholders in
// content and explanation, the solution range, and the mistake ranges. The
// templates stay in the options so the data can be rendered again for an
// attempt. Data without parametrization or mistakes is returned unchanged.
export function renderNumericalElementData<T extends RenderableNumericalData>(
  data: T,
  seedSource: string,
  // save-time validation renders without redraws so failing formulas surface
  { redraw = true }: { redraw?: boolean } = {}
): T {
  const { parametrization, mistakes } = data.options
  if (!isParametrizedNumerical(data.options) && !mistakes?.length) {
    return data
  }

  if (!parametrization || !isParametrizedNumerical(data.options)) {
    return {
      ...data,
      options: {
        ...data.options,
        mistakeRanges: computeMistakeRanges(
          mistakes ?? [],
          {},
          data.options.solutionRanges ??
            (data.options.exactSolutions ?? []).map((value) => ({
              min: value,
              max: value,
            }))
        ),
      },
    }
  }

  const contentTemplate = data.options.contentTemplate ?? data.content
  const explanationTemplate =
    data.options.explanationTemplate ?? data.explanation
  const { values, solutionRanges, mistakeRanges } = drawUsableValues(
    parametrization,
    mistakes ?? [],
    seedSource,
    redraw ? MAX_REDRAWS : 0
  )

  return {
    ...data,
    content: renderNumericalTemplate(contentTemplate, values, parametrization),
    explanation:
      typeof explanationTemplate === 'string'
        ? renderNumericalTemplate(explanationTemplate, values, parametrization)
        : explanationTemplate,
    options: {
      ...data.options,
      contentTemplate,
      explanationTemplate,
      solutionRanges,
      exactSolutions: undefined,
      mistakeRanges,
    },
  }
}

const MAX_REDRAWS = 20

// Saving checks a fixed set of sample draws, but an attempt's own seed can
// still hit a value a formula cannot handle, such as a negative square root.
// The seed is fixed per attempt, so such a draw would fail every read. A
// failing draw is replaced by a deterministic redraw from a suffixed seed.
function drawUsableValues(
  parametrization: NumericalParametrization,
  mistakes: readonly NumericalMistake[],
  seedSource: string,
  maxRedraws: number
) {
  let lastError: unknown
  for (let redraw = 0; redraw <= maxRedraws; redraw++) {
    try {
      const values = computeNumericalValues(
        parametrization,
        redraw === 0 ? seedSource : `${seedSource}:redraw${redraw}`
      )
      const solution = compileFormula(
        parametrization.solution.formula,
        new Set(Object.keys(values))
      ).evaluate(values)
      const solutionRanges = [
        {
          min: solution - parametrization.solution.tolerance,
          max: solution + parametrization.solution.tolerance,
        },
      ]
      return {
        values,
        solutionRanges,
        mistakeRanges: computeMistakeRanges(mistakes, values, solutionRanges),
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function checkName(name: string, seen: Set<string>, errors: string[]) {
  if (!NAME_PATTERN.test(name)) {
    errors.push(`"${name}" is not a valid name`)
  } else if (name in CONSTANTS || seen.has(name)) {
    errors.push(`The name "${name}" is used twice or reserved`)
  }
  seen.add(name)
}

function checkVariable(variable: NumericalVariable, errors: string[]) {
  if (variable.kind === 'PICK') {
    if (!variable.values?.length) {
      errors.push(`Variable "${variable.name}" needs at least one value`)
    }
    return
  }
  const { min, max } = variable
  if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
    errors.push(`Variable "${variable.name}" needs a minimum below its maximum`)
  }
  if (
    variable.kind === 'INTEGER' &&
    (!Number.isInteger(min) || !Number.isInteger(max))
  ) {
    errors.push(`Variable "${variable.name}" needs integer bounds`)
  }
  if (typeof variable.step === 'number' && variable.step <= 0) {
    errors.push(`Variable "${variable.name}" needs a positive step`)
  }
}

// Validates parametrization and mistakes when an element is saved. Returns a
// list of readable errors; an empty list means the data renders for every
// tested seed.
export function validateNumericalParametrization({
  content,
  explanation,
  options,
}: {
  content: string
  explanation?: string | null
  options: ElementOptionsNumerical
}): string[] {
  const errors: string[] = []
  const { parametrization, mistakes } = options
  const names = new Set<string>()

  if (parametrization) {
    if (!parametrization.variables?.length) {
      errors.push('Add at least one variable')
    }
    for (const variable of parametrization.variables ?? []) {
      checkName(variable.name, names, errors)
      checkVariable(variable, errors)
    }
    const known = new Set(names)
    for (const derived of parametrization.derived ?? []) {
      try {
        compileFormula(derived.formula, known)
      } catch (error) {
        errors.push(`${derived.name}: ${(error as Error).message}`)
      }
      checkName(derived.name, names, errors)
      known.add(derived.name)
    }
    try {
      compileFormula(parametrization.solution?.formula, names)
    } catch (error) {
      errors.push(`Solution: ${(error as Error).message}`)
    }
    if (!(parametrization.solution?.tolerance >= 0)) {
      errors.push('The solution needs a tolerance of zero or more')
    }
    for (const text of [content, explanation ?? '']) {
      for (const [, name] of text.matchAll(PLACEHOLDER_PATTERN)) {
        if (!names.has(name!)) errors.push(`Unknown placeholder "${name}"`)
      }
    }
  }

  const mistakeKeys = new Set<string>()
  for (const mistake of mistakes ?? []) {
    if (!mistake.key || mistakeKeys.has(mistake.key)) {
      errors.push(`Mistake key "${mistake.key}" is empty or used twice`)
    }
    mistakeKeys.add(mistake.key)
    if (!mistake.label?.trim()) {
      errors.push(`Mistake "${mistake.key}" needs a label`)
    }
    if (!(mistake.tolerance >= 0)) {
      errors.push(`Mistake "${mistake.key}" needs a tolerance of zero or more`)
    }
    try {
      compileFormula(mistake.formula, names)
    } catch (error) {
      errors.push(`Mistake "${mistake.key}": ${(error as Error).message}`)
    }
  }

  if (errors.length > 0) return errors

  const data = { content, explanation, options }
  for (let sample = 0; sample < VALIDATION_SAMPLES; sample++) {
    try {
      renderNumericalElementData(data, `validation:${sample}`, {
        redraw: false,
      })
    } catch (error) {
      return [(error as Error).message]
    }
  }
  return []
}

export interface NumericalPreviewSample {
  content: string
  explanation: string | null
  solutionMin: number | null
  solutionMax: number | null
  mistakes: Array<{ key: string; label: string; min: number; max: number }>
}

// Validates a draft like a save does and, when it is valid, renders a few
// sample draws so the lecturer sees what players will get.
export function previewNumericalElement(
  data: RenderableNumericalData,
  count = 3
): { errors: string[]; samples: NumericalPreviewSample[] } {
  const errors = validateNumericalParametrization(data)
  if (errors.length > 0) return { errors, samples: [] }
  const labels = new Map(
    (data.options.mistakes ?? []).map((mistake) => [mistake.key, mistake.label])
  )
  const samples = Array.from({ length: count }, (_, index) => {
    const rendered = renderNumericalElementData(data, `preview:${index}`)
    const range = rendered.options.solutionRanges?.[0]
    return {
      content: rendered.content,
      explanation: rendered.explanation ?? null,
      solutionMin: range?.min ?? null,
      solutionMax: range?.max ?? null,
      mistakes: (rendered.options.mistakeRanges ?? []).map((mistake) => ({
        ...mistake,
        label: labels.get(mistake.key) ?? mistake.key,
      })),
    }
  })
  return { errors: [], samples }
}

// Draws one fixed set of numbers for a new element instance. Activities
// without per-attempt play show these numbers to everyone, and grading,
// statistics and the Live Quiz cache use them like any numerical question.
export function renderInstanceElementData<T extends ElementData>(data: T): T {
  if (data.type !== 'NUMERICAL') return data
  return renderNumericalElementData(
    data as Extract<ElementData, { type: 'NUMERICAL' }>,
    `instance:${randomUUID()}`
  ) as T
}
