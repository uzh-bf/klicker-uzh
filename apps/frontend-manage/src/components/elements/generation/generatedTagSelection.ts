import type { Tag } from '@klicker-uzh/graphql/dist/ops'
import {
  type GeneratedQuestionTagSelection,
  normalizeGeneratedQuestionTagLabel,
  suggestGeneratedQuestionTags,
} from '@klicker-uzh/types'

// Structured tag selection for generated question drafts. Owner tags are
// addressed by their persisted id so a rename keeps their identity; proposals
// are exact names and are created only with a successful Keep.
export type GeneratedTagSelection = GeneratedQuestionTagSelection

export const EMPTY_TAG_SELECTION: GeneratedTagSelection = {
  existingTagIds: [],
  newTagNames: [],
}

// Advisory labels produced by generation. The generated GraphQL client is
// regenerated from the tracked operations, so this reader tolerates a snapshot
// that does not expose the field yet and never treats it as required.
export function draftSuggestedTags(draft: {
  suggestedTags?: readonly string[] | null
}): string[] {
  return Array.isArray(draft.suggestedTags) ? [...draft.suggestedTags] : []
}

// The persisted structured selection on the draft's current payload. It is the
// authoritative source of selected ids and proposals, so reload never has to
// re-derive an owner tag from a display name.
export function persistedTagSelection(current: {
  tagSelection?: {
    existingTagIds?: readonly number[] | null
    newTagNames?: readonly string[] | null
  } | null
}): GeneratedTagSelection {
  const selection = current.tagSelection
  if (!selection) return EMPTY_TAG_SELECTION
  return {
    existingTagIds: Array.isArray(selection.existingTagIds)
      ? [...selection.existingTagIds]
      : [],
    newTagNames: Array.isArray(selection.newTagNames)
      ? [...selection.newTagNames]
      : [],
  }
}

export type TagSuggestionGroups = {
  // Owner tags matching a generation suggestion, offered as independent toggles
  suggestedExisting: Tag[]
  // Exact-name owner tags available for manual selection
  selectableExisting: Tag[]
  // Suggestions without an owner tag yet; these are created only on Keep
  newProposals: string[]
}

// Rank the generated advisory labels against the owner's tags with the same
// lexical rules the service uses. Matching stays local, uses no model call, and
// never merges tags or preselects a suggestion.
export function groupTagSuggestions(
  suggestedTags: string[],
  userTags: Tag[]
): TagSuggestionGroups {
  const match = suggestGeneratedQuestionTags(suggestedTags, userTags)
  const byId = new Map(userTags.map((tag) => [tag.id, tag]))

  return {
    suggestedExisting: match.existingTagIds.flatMap((id) => {
      const tag = byId.get(id)
      return tag ? [tag] : []
    }),
    selectableExisting: userTags,
    newProposals: match.newTagNames,
  }
}

// Display order and deduplication of the names that mirror the selection into
// the form's legacy `tags` field and the draft's persisted `current.tags`.
export function selectedTagNames(
  selection: GeneratedTagSelection,
  userTags: Tag[]
): string[] {
  const byId = new Map(userTags.map((tag) => [tag.id, tag.name]))
  const existingNames = selection.existingTagIds.flatMap((id) => {
    const name = byId.get(id)
    return name ? [name] : []
  })
  return [...new Set([...existingNames, ...selection.newTagNames])]
}

// Resolve manually entered tag names against the owner's tags using exact-name
// identity only. A typed name equal to an existing tag name becomes an id
// selection, so a rename is never duplicated by name, while fuzzy matches are
// deliberately not used as a persistence key.
export function resolveManualTagNames(
  names: string[],
  userTags: Tag[]
): GeneratedTagSelection {
  const existingIdsByLabel = new Map<string, number[]>()
  for (const tag of userTags) {
    const label = tag.name
    const ids = existingIdsByLabel.get(label) ?? []
    ids.push(tag.id)
    existingIdsByLabel.set(label, ids)
  }

  const existingTagIds: number[] = []
  const newTagNames: string[] = []
  const seenIds = new Set<number>()
  const seenNames = new Set<string>()
  for (const name of names) {
    const label = normalizeGeneratedQuestionTagLabel(name)
    if (!label) continue

    const match = existingIdsByLabel.get(label)?.[0]
    if (typeof match === 'number') {
      if (!seenIds.has(match)) {
        seenIds.add(match)
        existingTagIds.push(match)
      }
      continue
    }
    if (!seenNames.has(label)) {
      seenNames.add(label)
      newTagNames.push(label)
    }
  }
  return { existingTagIds, newTagNames }
}
