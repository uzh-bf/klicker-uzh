/* eslint-disable no-unused-vars */

import _every from 'lodash/every'
import moment from 'moment'

function filterQuestions(questions, filters) {
  return questions.filter((question) => {
    if (filters.type && question.type !== filters.type) {
      return false
    }
    if (filters.title && !question.title.toLowerCase().includes(filters.title.toLowerCase())) {
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

function processItems(items, filters, sort) {
  let processed = items

  console.log(sort)

  if (filters) {
    processed = filterQuestions(processed, filters)
  }

  if (sort) {
    console.log('Sorting')
    processed = sortQuestions(processed, sort)
  }

  return processed
}

export { filterSessions, processItems }
