import dayjs from 'dayjs'
// import Fuse from 'fuse.js'
import { Element } from '@klicker-uzh/graphql/dist/ops'
import {
  QuestionPoolFilters,
  QuestionPoolSortType,
  SortyByType,
} from '@lib/hooks/useSortingAndFiltering'
import * as JsSearch from 'js-search'

export function buildIndex(
  name: string,
  items: Element[],
  searchIndices: string[]
): JsSearch.Search {
  // build a new js-search index
  const search = new JsSearch.Search('id')

  // use the TF-IDF strategy
  search.searchIndex = new JsSearch.TfIdfSearchIndex('id')

  // look for all substrings, not only prefixed
  search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()

  // index by properties
  searchIndices.forEach((index): void => search.addIndex(index))

  // build the index based on the items
  search.addDocuments(items)

  return search
}

// TODO: optimize for one pass instead of stacked passes
function filterQuestions(
  questions: Element[],
  filters: QuestionPoolFilters,
  index: JsSearch.Search | null
): Element[] {
  let results = [...questions]

  // if a title (query) was given, search the index with it
  if (index && filters.name) {
    results = index.search(filters.name) as Element[]
  }

  return results
}

function sortQuestions(
  questions: Element[],
  sort: QuestionPoolSortType
): Element[] {
  const factor = sort.asc ? 1 : -1

  if (sort.by === SortyByType.TITLE) {
    return questions.sort(
      (a, b): number => factor * a.name.localeCompare(b.name)
    )
  }

  if (sort.by === SortyByType.TYPE) {
    return questions.sort(
      (a, b): number => factor * a.type.localeCompare(b.type)
    )
  }

  if (sort.by === SortyByType.CREATED) {
    return questions.sort(
      (a, b): number => factor * dayjs(a.createdAt).diff(dayjs(b.createdAt))
    )
  }

  if (sort.by === SortyByType.MODIFIED) {
    return questions.sort(
      (a, b): number => factor * dayjs(a.updatedAt).diff(dayjs(b.updatedAt))
    )
  }

  return questions
}

export function processItems(
  items: Element[],
  filters: QuestionPoolFilters,
  sort: QuestionPoolSortType,
  index: JsSearch.Search | null
): Element[] {
  let processed = items

  if (filters) {
    processed = filterQuestions(processed, filters, index)
  }

  if (sort) {
    processed = sortQuestions(processed, sort)
  }

  return processed
}
