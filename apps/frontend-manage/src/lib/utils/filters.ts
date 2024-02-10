import dayjs from 'dayjs'
import _every from 'lodash/every'
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

  if (name !== 'users') {
    // impedes the user search, must it be included for the other types?
    search.tokenizer = new JsSearch.StopWordsTokenizer(
      new JsSearch.SimpleTokenizer()
    )
  }

  // index by title, type, creation date and the description of the first version
  searchIndices.forEach((index): void => search.addIndex(index))

  // build the index based on the items
  search.addDocuments(items)

  return search
}

// TODO: optimize for one pass instead of stacked passes
export function filterQuestions(
  questions: Partial<Element>[],
  filters: QuestionPoolFilters,
  index: JsSearch.Search | null
): Partial<Element>[] {
  let results = [...questions]

  // if a title (query) was given, search the index with it
  if (index && filters.name) {
    results = index.search(filters.name)
  }

  // only reduce the shown questions to the non-archived ones, if the archive filter is not active
  if (!filters.archive) {
    results = results.filter(
      ({ isArchived }): boolean =>
        (typeof isArchived === 'undefined' && !filters.archive) ||
        isArchived === false
    )
  }

  // if a sample solution filter was selected, only show questions with a sample solution
  if (filters.sampleSolution) {
    results = results.filter(
      ({ options }) => options.hasSampleSolution === true
    )
  }

  // if an answer feedback filter was selected, only show questions with answer feedbacks
  if (filters.answerFeedbacks) {
    results = results.filter(
      ({ options }) => options.hasAnswerFeedbacks === true
    )
  }

  // if either type or tags were selected, filter the results
  if (filters.type || filters.tags) {
    results = results.filter(({ type, tags }): boolean => {
      // compare the type selected and the type of each question
      if (filters.type && type !== filters.type) {
        return false
      }

      // compare the tags selected and check whether the question fulfills all of them
      if (
        filters.tags &&
        !_every(
          filters.tags,
          (tag): boolean =>
            tags?.map((t): string => t.name).includes(tag) ?? false
        )
      ) {
        return false
      }

      return true
    })
  }

  return results
}

export function sortQuestions(
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

  // TODO: if desired, fetch instances / number of instances as well and re-introduce this option
  // if (sort.by === SortyByType.USED) {
  //   return questions.sort((a, b): number => {
  //     if (a.instances.length === 0 || b.instances.length === 0) {
  //       if (a.instances.length === 0 && b.instances.length === 0) {
  //         return 0
  //       }

  //       return factor * 1
  //     }

  //     // compare the dates of the latest created instances
  //     // this allows us to sort by "last usage"
  //     return (
  //       factor *
  //       subtractDates(
  //         dayjs(a.instances[a.instances.length - 1].createdAt),
  //         dayjs(b.instances[b.instances.length - 1].createdAt)
  //       )
  //     )
  //   })
  // }

  return questions
}

export function processItems(
  items: Partial<Element>[],
  filters: QuestionPoolFilters,
  sort: QuestionPoolSortType,
  index: JsSearch.Search | null
): Partial<Element>[] {
  let processed = items

  if (filters) {
    processed = filterQuestions(processed, filters, index)
  }

  if (sort) {
    processed = sortQuestions(processed, sort)
  }

  return processed
}
