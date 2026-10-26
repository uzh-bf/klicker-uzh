import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { motion, useReducedMotion } from 'motion/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const motionRequire = createRequire(require.resolve('motion/react'))
const framerMotionRequire = createRequire(
  motionRequire.resolve('framer-motion')
)

test('leaderboard animations share the renderer React instance', () => {
  const react = require('react')
  const rendererRequire = createRequire(require.resolve('react-dom'))

  assert.equal(rendererRequire('react'), react)
  assert.equal(motionRequire('react'), react)
  assert.equal(framerMotionRequire('react'), react)
})

test('the leaderboard reduced-motion hook renders with React DOM', () => {
  function AnimatedEntry() {
    const reducedMotion = useReducedMotion()
    return createElement(motion.div, { layout: !reducedMotion })
  }

  assert.doesNotThrow(() => renderToStaticMarkup(createElement(AnimatedEntry)))
})
