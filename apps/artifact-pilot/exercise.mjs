import { createHash } from 'node:crypto'

export const digest = (value) =>
  createHash('sha256').update(value).digest('hex')
const opening =
  '<!doctype html><html lang="en"><meta charset="utf-8"><title>Bond calculator</title><main></main><script type="application/json" id="exercise">'
const closeData = '</script>'

function validate(exercise) {
  function requireValue(condition) {
    if (!condition) throw new Error('Unsupported bond exercise definition')
  }
  function fields(value, keys) {
    requireValue(value && typeof value === 'object' && !Array.isArray(value))
    requireValue(
      Object.keys(value).sort().join('|') === [...keys].sort().join('|')
    )
  }
  fields(exercise, ['title', 'years', 'face', 'cashflows'])
  requireValue(
    typeof exercise.title === 'string' &&
      exercise.title.trim().length > 0 &&
      exercise.title.length <= 100 &&
      !/[<>&\u0000-\u001f]/u.test(exercise.title)
  )
  requireValue(
    Number.isInteger(exercise.years) &&
      exercise.years >= 1 &&
      exercise.years <= 30
  )
  requireValue(
    Number.isFinite(exercise.face) &&
      exercise.face > 0 &&
      exercise.face <= 1000000
  )
  requireValue(
    Array.isArray(exercise.cashflows) &&
      exercise.cashflows.length > 0 &&
      exercise.cashflows.length <= 8
  )
  for (const flow of exercise.cashflows) {
    fields(flow, ['when', 'amount'])
    requireValue(['maturity', 'year-end'].includes(flow.when))
    requireValue(
      flow.amount === 'face' ||
        (Number.isFinite(flow.amount) &&
          flow.amount >= 0 &&
          flow.amount <= 1000000)
    )
  }
  return exercise
}

function price(exercise, percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    throw new Error('Yield must be between 0 and 100')
  let result = 0
  for (let year = 1; year <= exercise.years; year++) {
    for (const flow of exercise.cashflows) {
      if (flow.when === 'year-end' || year === exercise.years) {
        const amount = flow.amount === 'face' ? exercise.face : flow.amount
        result += amount / (1 + percent / 100) ** year
      }
    }
  }
  return result
}

function mount(exercise) {
  const main = document.querySelector('main')
  const heading = document.createElement('h1')
  heading.textContent = exercise.title
  const label = document.createElement('label')
  label.textContent = 'Yield (%) '
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '0'
  input.max = '100'
  input.step = 'any'
  input.value = '5'
  label.append(input)
  const result = document.createElement('output')
  function update() {
    result.textContent =
      input.value !== '' && input.validity.valid
        ? 'CHF ' + price(exercise, input.valueAsNumber).toFixed(2)
        : 'Enter a yield between 0 and 100.'
  }
  input.addEventListener('input', update)
  main.replaceChildren(heading, label, result)
  update()
}

const library = [validate, price, mount].map((fn) => fn.toString()).join('\n')
const standalone =
  library +
  '\nmount(validate(JSON.parse(document.getElementById("exercise").textContent)))'
const suffix = closeData + '<script>' + standalone + '</script></html>'

export function sourceFor(exercise) {
  return opening + JSON.stringify(validate(exercise)) + suffix
}

export function parseSource(html) {
  if (
    typeof html !== 'string' ||
    Buffer.byteLength(html) > 65536 ||
    !html.startsWith(opening) ||
    !html.endsWith(suffix)
  ) {
    throw new Error(
      'Use the pilot bond calculator template and edit its exercise definition'
    )
  }
  const json = html.slice(opening.length, -suffix.length)
  if (json.includes('<'))
    throw new Error('Unexpected markup in exercise definition')
  return validate(JSON.parse(json))
}

export const baseExercise = {
  title: 'Zero-coupon bond',
  years: 2,
  face: 1000,
  cashflows: [{ when: 'maturity', amount: 'face' }],
}

// The frame contains no private data until its authorized parent sends an exercise.
export function frame(parents) {
  const script =
    library +
    '\nconst parents = new Set(' +
    JSON.stringify(parents) +
    ');\n' +
    'addEventListener("message", event => {\n' +
    '  if (event.source !== parent || !parents.has(event.origin) || event.data?.type !== "activity-artifact") return;\n' +
    '  try { mount(validate(event.data.exercise)) } catch { document.querySelector("main").replaceChildren() }\n' +
    '});'
  const hash = createHash('sha256').update(script).digest('base64')
  return {
    html:
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>Activity calculator</title><main></main><script>' +
      script +
      '</script></html>',
    policy:
      "default-src 'none'; script-src 'sha256-" +
      hash +
      "'; form-action 'none'; base-uri 'none'; frame-ancestors " +
      parents.join(' ') +
      '; sandbox allow-scripts',
  }
}

export { price }
