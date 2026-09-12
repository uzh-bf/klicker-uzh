import type { Tag } from '@klicker-uzh/graphql/dist/ops'
import { useMemo, useState } from 'react'
import {
  type GeneratedTagSelection,
  resolveManualTagNames,
  selectedTagNames,
} from './generatedTagSelection'

// Owner-scoped tag selection for a generated question draft. The persisted
// structured selection is authoritative: owner tags stay addressed by their id
// so a rename keeps the tag's identity, new proposals stay names until the draft
// is kept, and a deleted tag is never silently recreated by name. Matching stays
// local and lexical, so no tag collection leaves Klicker and no model call is
// involved.
export default function useGeneratedTagSelection({
  persistedSelection,
  selectableExisting,
}: {
  persistedSelection: GeneratedTagSelection
  selectableExisting: Tag[]
}) {
  // `undefined` keeps the persisted selection; the first user change commits an
  // explicit selection.
  const [edit, setEdit] = useState<GeneratedTagSelection | undefined>()
  const selection = edit ?? persistedSelection

  const names = useMemo(
    () => selectedTagNames(selection, selectableExisting),
    [selection, selectableExisting]
  )

  function commit(next: GeneratedTagSelection) {
    setEdit(next)
  }

  function toggleExistingTag(tagId: number) {
    commit({
      existingTagIds: selection.existingTagIds.includes(tagId)
        ? selection.existingTagIds.filter((id) => id !== tagId)
        : [...selection.existingTagIds, tagId],
      newTagNames: selection.newTagNames,
    })
  }

  function toggleNewTagName(name: string) {
    commit({
      existingTagIds: selection.existingTagIds,
      newTagNames: selection.newTagNames.includes(name)
        ? selection.newTagNames.filter((entry) => entry !== name)
        : [...selection.newTagNames, name],
    })
  }

  // Manual edits own the complete union of selected tags, so they replace the
  // selection instead of extending it.
  function setManualNames(nextNames: string[]) {
    commit(resolveManualTagNames(nextNames, selectableExisting))
  }

  return {
    selection,
    names,
    toggleExistingTag,
    toggleNewTagName,
    setManualNames,
  }
}
