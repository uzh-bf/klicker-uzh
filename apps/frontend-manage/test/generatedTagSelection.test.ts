import assert from 'node:assert/strict'
import type { Tag } from '@klicker-uzh/graphql/dist/ops.js'
import {
  persistedTagSelection,
  resolveManualTagNames,
  selectedTagNames,
} from '../src/components/elements/generation/generatedTagSelection.ts'

// Owner tags whose stored names differ from their normalized form. A typed
// name that normalizes to the same label must select the existing tag instead
// of proposing a duplicate.
const ownerTags: Tag[] = [
  { id: 7, name: '  Portfolio   Theorie  ', order: 0 },
  { id: 8, name: 'Regression', order: 1 },
]

assert.deepEqual(resolveManualTagNames(['Portfolio Theorie'], ownerTags), {
  existingTagIds: [7],
  newTagNames: [],
})

assert.deepEqual(resolveManualTagNames(['  Regression  '], ownerTags), {
  existingTagIds: [8],
  newTagNames: [],
})

// A name without an owner tag stays a proposal.
assert.deepEqual(resolveManualTagNames(['Neuartig'], ownerTags), {
  existingTagIds: [],
  newTagNames: ['Neuartig'],
})

// The selected display names follow the persisted selection and stay unique.
assert.deepEqual(
  selectedTagNames(
    { existingTagIds: [8, 7], newTagNames: ['Neuartig'] },
    ownerTags
  ),
  ['Regression', '  Portfolio   Theorie  ', 'Neuartig']
)

// A draft without a persisted selection yields the empty selection, and each
// call returns a distinct object so callers cannot corrupt a shared value.
const first = persistedTagSelection({})
const second = persistedTagSelection({ tagSelection: null })
assert.deepEqual(first, { existingTagIds: [], newTagNames: [] })
assert.deepEqual(second, { existingTagIds: [], newTagNames: [] })
assert.notEqual(first, second)

// A persisted selection is copied rather than aliased.
const persisted = persistedTagSelection({
  tagSelection: { existingTagIds: [7], newTagNames: ['Neuartig'] },
})
assert.deepEqual(persisted, { existingTagIds: [7], newTagNames: ['Neuartig'] })
