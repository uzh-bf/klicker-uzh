/* eslint-disable no-unused-vars */

import _every from 'lodash/every'

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

function filterSessions(sessions, filters) {
  return sessions
}

export { filterQuestions, filterSessions }
