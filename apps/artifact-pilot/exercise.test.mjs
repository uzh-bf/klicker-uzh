import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseExercise,
  frame,
  parseSource,
  price,
  sourceFor,
} from './exercise.mjs'

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
  assert.throws(() => parseSource(source.replace('<main>', '<main hidden>')))
  assert.throws(() => parseSource(source.replace('"years":2', '"years":3000')))
  assert.throws(() =>
    parseSource(source.replace('"face":1000', '"face":1000,"extra":true'))
  )
  assert.throws(() => price(baseExercise, Infinity))
})
test('stored revisions survive renderer changes while admission stays strict', () => {
  const historical = sourceFor(baseExercise).replace(
    '</script></html>',
    '\n// renderer program from a later template version\n</script></html>'
  )
  assert.deepEqual(parseSource(historical, { strict: false }), baseExercise)
  assert.throws(() => parseSource(historical))
  assert.throws(() =>
    parseSource(
      historical.replace('"face":1000', '"face":1000,<b>invalid</b>'),
      { strict: false }
    )
  )
})
test('isolated frame carries only a fixed program and constrains its parents', () => {
  const { policy, html } = frame(['https://course.example'])
  assert.match(policy, /sandbox allow-scripts$/)
  assert.match(policy, /frame-ancestors https:\/\/course\.example;/)
  assert.ok(!html.includes(baseExercise.title))
})
