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
  console.log(sort)
  console.log(questions)

  let sorted = questions

  if (sort.by === 'TITLE') {
    sorted = questions.sort((a, b) => a.title.localeCompare(b.title))
    if (!sort.asc) {
      sorted = sorted.reverse()
    }
  } else if (sort.by === 'TYPE') {
    sorted = questions.sort((a, b) => a.type.localeCompare(b.type))
    if (!sort.asc) {
      sorted = sorted.reverse()
    }
  } else if (sort.by === 'CREATED') {
    sorted = questions.sort((a, b) => {
      if (a.instances.length === 0 || b.instances.length === 0) {
        return 1
      }

      return (
        moment(a.instances[a.instances.length - 1].createdAt) -
        moment(b.instances[b.instances.length - 1].createdAt)
      )
    })

    if (!sort.asc) {
      sorted = sorted.reverse()
    }
  }

  return sorted
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
