/* eslint-disable no-unused-vars */

import _every from 'lodash/every'
import moment from 'moment'
// import Fuse from 'fuse.js'
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

function buildIndex(name, items, searchIndices) {
  // if an index already exists, return it
  if (indices[name]) {
    return indices[name]
  }

  // build a new js-search index
  const search = new JsSearch.Search('id')

  // use the TF-IDF strategy
  search.searchIndex = new JsSearch.TfIdfSearchIndex()

  // look for all substrings, not only prefixed
  search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
  // search.tokenizer = new JsSearch.StopWordsTokenizer(new JsSearch.SimpleTokenizer())

  // index by title, type, creation date and the description of the first version
  searchIndices.forEach(index => search.addIndex(index))

  // build the index based on the items
  search.addDocuments(items)

  // store the index and return it (singleton)
  indices[name] = search
  return search
}

function filterQuestions(questions, filters, index) {
  let results = questions

  // if a title (query) was given, search the index with it
  if (filters.title) {
    results = index.search(filters.title)
  }

  // if either type or tags were selected, filter the results
  if (filters.type || filters.tags) {
    results = results.filter(({ archived, type, tags }) => {
      // if the archive is activated and a question is not archived
      if (filters.archive && !archived) {
        return false
      }

      // compare the type selected and the type of each question
      if (filters.type && type !== filters.type) {
        return false
      }

      // compare the tags selected and check whether the question fulfills all of them
      if (filters.tags && !_every(filters.tags, tag => tags.map(t => t.name).includes(tag))) {
        return false
      }

      return true
    })
  }

  return results
}

function filterSessions(sessions, filters, index) {
  let results = sessions

  if (filters.title) {
    results = index.search(filters.title)
  }

  return results
}

function sortQuestions(questions, sort) {
  const factor = sort.asc ? 1 : -1

  if (sort.by === 'TITLE') {
    return questions.sort((a, b) => factor * a.title.localeCompare(b.title))
  }

  if (sort.by === 'TYPE') {
    return questions.sort((a, b) => factor * a.type.localeCompare(b.type))
  }

  if (sort.by === 'CREATED') {
    return questions.sort((a, b) => factor * (moment(a.createdAt) - moment(b.createdAt)))
  }

  if (sort.by === 'USED') {
    return questions.sort((a, b) => {
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
        (moment(a.instances[a.instances.length - 1].createdAt) -
          moment(b.instances[b.instances.length - 1].createdAt))
      )
    })
  }

  return questions
}

function processItems(items, filters, sort, index) {
  let processed = items

  if (filters) {
    processed = filterQuestions(processed, filters, index)
  }

  if (sort) {
    processed = sortQuestions(processed, sort)
  }

  return processed
}

export { filterSessions, processItems, buildIndex }
