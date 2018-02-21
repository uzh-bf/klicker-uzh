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

function buildIndex(name, items) {
  /* if (indices[name]) {
    return indices[name]
  }

  indices[name] = new Fuse(items, INDEX_CONFIGS[name])
  return indices[name] */

  if (indices[name]) {
    return indices[name]
  }

  const search = JsSearch.Search('id')
  search.addIndex('title')
  search.addIndex('type')
  search.addIndex(['versions', 'description'])
  search.addIndex(['tags', 'name'])
  search.addDocuments(items)
  indices[name] = search
  return search
}

function filterQuestions(questions, filters, index) {
  console.log(filters)

  let results = questions

  if (filters.title) {
    // results = index.search(filters.title)
    results = index.search(filters.title)
    console.log(results)
  }

  if (filters.type || filters.tags) {
    results = results.filter((question) => {
      if (filters.type && question.type !== filters.type) {
        return false
      }
      if (
        filters.tags &&
        !_every(filters.tags, tag => question.tags.map(t => t.name).includes(tag))
      ) {
        return false
      }
      return true
    })
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

function filterSessions(sessions, filters) {
  return sessions
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
