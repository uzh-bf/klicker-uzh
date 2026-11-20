import type {
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
  const declared =
    parametrization.variables.find((variable) => variable.name === name)
      ?.decimals ??
    parametrization.derived?.find((derived) => derived.name === name)?.decimals
  if (typeof declared === 'number') return declared
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
  seedSource: string
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

  const values = computeNumericalValues(parametrization, seedSource)
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
    ...data,
    content: renderNumericalTemplate(data.content, values, parametrization),
    explanation:
      typeof data.explanation === 'string'
        ? renderNumericalTemplate(data.explanation, values, parametrization)
        : data.explanation,
    options: {
      ...data.options,
      solutionRanges,
      exactSolutions: undefined,
      mistakeRanges: computeMistakeRanges(
        mistakes ?? [],
        values,
        solutionRanges
      ),
    },
  }
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
      renderNumericalElementData(data, `validation:${sample}`)
    } catch (error) {
      return [(error as Error).message]
    }
  }
  return []
}
