// @flow

import _every from 'lodash/every'

type Question = {
  id: string,
  tags: Array<string>,
  title: string,
  type: 'SC' | 'MC' | 'FREE',
}

type QuestionFilters = {
  tags: ?Array<string>,
  title: ?string,
  type: ?string,
}

function filterQuestions(questions: Question[], filters: QuestionFilters) {
  return questions.filter((question) => {
    if (filters.title && !question.title.includes(filters.title)) {
      return false
    }
    if (filters.tags && !_every(filters.tags, tag => question.tags.includes(tag))) {
      return false
    }
    if (filters.type && question.type !== filters.type) {
      return false
    }
    return true
  })
}

function filterSessions(sessions: any, filters: any) {
  return sessions
}

export { filterQuestions, filterSessions }
