import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  baseExercise,
  frame,
  parseSource,
  price,
  sourceFor,
  styleHash,
  stylesheet,
} from './exercise.mjs'
import { artifactClasses, artifactRootClass } from './starter-style.mjs'

test('saved template and edited cash flows reproduce the assigned calculations', () => {
  const base = parseSource(sourceFor(baseExercise))
  const coupon = parseSource(
    sourceFor({
      ...base,
      cashflows: [...base.cashflows, { when: 'year-end', amount: 50 }],
    })
  )
  assert.deepEqual(
    [5, 10].map((y) => price(base, y).toFixed(2)),
    ['907.03', '826.45']
  )
  assert.deepEqual(
    [5, 10].map((y) => price(coupon, y).toFixed(2)),
    ['1000.00', '913.22']
  )
})
test('admission requires a closed template and bounded data', () => {
  const source = sourceFor(baseExercise)
  assert.throws(() =>
    parseSource(
      source.replace(
        ' data-klicker-activity-artifact="1"',
        ' data-klicker-activity-artifact="2"'
      )
    )
  )
  assert.throws(() =>
    parseSource(source.replace('<main class=', '<main hidden class='))
  )
  assert.throws(() => parseSource(source.replace('"years":2', '"years":3000')))
  assert.throws(() => parseSource(source.replace('"face":1000,', '')))
  assert.throws(() =>
    parseSource(source.replace('"face":1000', '"face":1000,"extra":true'))
  )
  assert.throws(() => price(baseExercise, Infinity))
})
test('title admission rejects every Unicode control character', () => {
  assert.equal(
    parseSource(sourceFor({ ...baseExercise, title: 'Bond pricing' })).title,
    'Bond pricing'
  )
  assert.throws(() =>
    sourceFor({ ...baseExercise, title: 'Bond\u0085pricing' })
  )
})
test('exact-key admission is independent of JSON member order', () => {
  const reordered = sourceFor({
    cashflows: baseExercise.cashflows,
    face: baseExercise.face,
    years: baseExercise.years,
    title: baseExercise.title,
  })
  assert.deepEqual(parseSource(reordered), baseExercise)
})
test('stored revisions survive renderer changes while admission stays strict', () => {
  const historical =
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Bond calculator</title><main></main><script type="application/json" id="exercise">' +
    JSON.stringify(baseExercise) +
    '</script><script>// renderer program from an older template version</script></html>'
  assert.deepEqual(parseSource(historical, { strict: false }), baseExercise)
  assert.throws(() => parseSource(historical))
  assert.throws(() =>
    parseSource(
      historical.replace('"face":1000', '"face":1000,<b>invalid</b>'),
      { strict: false }
    )
  )
})
test('the styling marker is a template hint and not an admission signal', () => {
  const source = sourceFor(baseExercise)
  const marker =
    '<!doctype html><html lang="en" data-klicker-activity-artifact="1">'
  assert.ok(source.startsWith(marker))
  assert.match(
    source,
    /<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">/
  )

  const unmarked = source.replace(' data-klicker-activity-artifact="1"', '')
  assert.deepEqual(parseSource(unmarked, { strict: false }), baseExercise)
  assert.throws(() => parseSource(unmarked))
})
test('standalone and frame share the generated offline UZH starter styles', () => {
  const standalone = sourceFor(baseExercise)
  const framed = frame(['https://course.example']).html
  const styleElement = '<style>' + stylesheet + '</style>'
  const bodyClass = artifactRootClass + ' ' + artifactClasses.body

  assert.equal(standalone.split(styleElement).length, 2)
  assert.equal(framed.split(styleElement).length, 2)
  assert.ok(standalone.includes('<body class="' + bodyClass + '">'))
  assert.ok(framed.includes('<body class="' + bodyClass + '">'))
  assert.ok(
    standalone.includes('<main class="' + artifactClasses.main + '"></main>')
  )
  assert.ok(
    framed.includes('<main class="' + artifactClasses.main + '"></main>')
  )

  assert.match(
    stylesheet,
    /font-family: "Source Sans 3", "Source Sans Pro", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/
  )
  assert.doesNotMatch(stylesheet, /@font-face|data:/)
  assert.ok(stylesheet.includes('#0028a5'))
  assert.ok(stylesheet.includes('#edeff1'))
  assert.ok(stylesheet.includes('#c8ced4'))
  assert.match(stylesheet, /\.uzh-artifact \.sm\\:p-8/)
  assert.match(
    stylesheet,
    /\.uzh-artifact \.focus-visible\\:outline-2:focus-visible/
  )
  assert.match(stylesheet, /:where\(\.uzh-artifact\) :focus-visible/)
  assert.doesNotMatch(stylesheet, /https?:\/\//)
  assert.ok(Buffer.byteLength(stylesheet, 'utf8') < 8192)
  assert.ok(Buffer.byteLength(standalone, 'utf8') < 16384)
})
test('isolated frame carries only a fixed program and constrains its parents', () => {
  const { policy, html } = frame(['https://course.example'])
  assert.match(policy, /sandbox allow-scripts$/)
  assert.match(policy, /frame-ancestors https:\/\/course\.example;/)
  assert.match(policy, /default-src 'none';/)
  assert.ok(policy.includes("style-src 'sha256-" + styleHash + "'"))
  assert.doesNotMatch(policy, /font-src|data:/)
  assert.ok(!policy.includes('unsafe-inline'))
  assert.equal(
    styleHash,
    createHash('sha256').update(stylesheet).digest('base64')
  )
  assert.ok(!html.includes(baseExercise.title))
})
