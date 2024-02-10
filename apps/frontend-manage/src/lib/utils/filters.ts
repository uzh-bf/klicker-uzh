/* eslint-disable no-unused-vars */
// TODO: typing

import dayjs from 'dayjs'
import _every from 'lodash/every'
// import Fuse from 'fuse.js'
import { Element } from '@klicker-uzh/graphql/dist/ops'
import { QuestionPoolReducerActionType } from '@lib/hooks/useSortingAndFiltering'
import * as JsSearch from 'js-search'

const indices = {}

/* const INDEX_CONFIGS = {
  questions: {
    location: 0,
    distance: 100,
    threshold: 0.5,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    tokenize: true,
    matchAllTokens: true,
    includeScore: true,
    includeMatches: true,
    // TODO: add description to search keys?
    keys: ['title', 'tags.name', 'type'],
  },
} */

export function buildIndex(
  name: string,
  items: any[],
  searchIndices: any[]
): any[] {
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

  // store the index and return it (singleton)
  indices[name] = search
  return search
}

// TODO: optimize for one pass instead of stacked passes
export function filterQuestions(
  questions: Partial<Element>[],
  filters: any,
  index: any
): any[] {
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
      if (
        filters.type &&
        filters.type !== QuestionPoolReducerActionType.UNDEFINED &&
        type !== filters.type
      ) {
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

// both used for sessions and users
export function filterByTitle(objects: any[], filters: any, index: any): any[] {
  let results = objects

  if (filters.title) {
    results = index.search(filters.title)
  }

  return results
}

export function subtractDates(date1: any, date2: any): any {
  return date1 - date2
}

export function sortQuestions(questions: any[], sort: any): any[] {
  const factor = sort.asc ? 1 : -1

  if (sort.by === 'TITLE') {
    return questions.sort(
      (a, b): number => factor * a.name.localeCompare(b.name)
    )
  }

  if (sort.by === 'TYPE') {
    return questions.sort(
      (a, b): number => factor * a.type.localeCompare(b.type)
    )
  }

  if (sort.by === 'CREATED') {
    return questions.sort(
      (a, b): number =>
        factor * subtractDates(dayjs(a.createdAt), dayjs(b.createdAt))
    )
  }

  if (sort.by === 'USED') {
    return questions.sort((a, b): number => {
      if (a.instances.length === 0 || b.instances.length === 0) {
        if (a.instances.length === 0 && b.instances.length === 0) {
          return 0
        }

        return factor * 1
      }

      // compare the dates of the latest created instances
      // this allows us to sort by "last usage"
      return (
        factor *
        subtractDates(
          dayjs(a.instances[a.instances.length - 1].createdAt),
          dayjs(b.instances[b.instances.length - 1].createdAt)
        )
      )
    })
  }

  return questions
}

export function processItems(
  items: Partial<Element>[],
  filters,
  sort,
  index
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
