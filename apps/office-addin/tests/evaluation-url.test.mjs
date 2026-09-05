import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSafeEvaluationUrl,
  isValidEvaluationUrl,
} from '../src/content/evaluation-url.ts'

const quizId = '123e4567-e89b-12d3-a456-426614174000'
const hmac = 'a'.repeat(64)

test('accepts current and legacy KlickerUZH evaluation routes', () => {
  assert.equal(
    isValidEvaluationUrl(
      `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=${hmac}`
    ),
    true
  )
  assert.equal(
    isValidEvaluationUrl(
      `https://manage.klicker.uzh.ch/de/quizzes/${quizId}/evaluation?hmac=${hmac}&questionIx=2&hideControls=true`
    ),
    true
  )
  assert.equal(
    isValidEvaluationUrl(
      `https://manage.klicker.uzh.ch/sessions/${quizId}/evaluation?hmac=${hmac}`
    ),
    true
  )
})

test('rejects URLs outside the exact KlickerUZH evaluation contract', () => {
  const invalidUrls = [
    `http://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch.example.com/quizzes/${quizId}/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch:444/quizzes/${quizId}/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/quizzes/not-a-uuid/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=short`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=${'z'.repeat(64)}`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=${'A'.repeat(64)}`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation?hmac=${hmac}&hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation#hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/fr/quizzes/${quizId}/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/quizzes//${quizId}/evaluation?hmac=${hmac}`,
    `https://manage.klicker.uzh.ch/quizzes/${quizId}/evaluation/?hmac=${hmac}`,
  ]

  for (const url of invalidUrls) {
    assert.equal(isValidEvaluationUrl(url), false, url)
  }
})

test('rebuilds valid URLs with URI-encoded dynamic parameters', () => {
  assert.equal(
    getSafeEvaluationUrl(
      `https://manage.klicker.uzh.ch/de/quizzes/${quizId}/evaluation?hmac=${hmac}&label=%3Cscript%3Ealert(1)%3C%2Fscript%3E`
    ),
    `https://manage.klicker.uzh.ch/de/quizzes/${quizId}/evaluation?hmac=${hmac}&label=%3Cscript%3Ealert(1)%3C%2Fscript%3E`
  )
})
