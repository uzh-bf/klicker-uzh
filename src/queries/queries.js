// @flow

import { gql } from 'react-apollo'

type TagListType = {
  loading: boolean,
  error?: string,
  tags: Array<{
    id: string,
    name: string,
  }>,
}
const TagListQuery = gql`
  {
    tags: allTags(orderBy: name_ASC) {
      id
      name
    }
  }
`

type QuestionListType = {
  loading: boolean,
  error?: string,
  questions: Array<{
    id: string,
    title: string,
    type: string,
    instances: Array<{
      id: string,
      createdAt: string,
    }>,
    tags: Array<{
      id: string,
      name: string,
    }>,
    versions: Array<{
      id: string,
      createdAt: string,
    }>,
    createdAt: string,
    updatedAt: string,
  }>,
}
const QuestionListQuery = gql`
  {
    questions: allQuestionDefinitions {
      id
      title
      type
      instances(orderBy: createdAt_DESC, first: 3) {
        id
        createdAt
      }
      tags {
        id
        name
      }
      versions {
        id
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`

type QrGeneratorType = {
  loading: boolean,
  error?: string,
  user: {
    shortname: string,
  },
}
const QrGeneratorQuery = gql`
  {
    user {
      shortname
    }
  }
`

type SessionListType = {
  loading: boolean,
  error?: string,
  sessions: Array<{
    id: string,
    name: string,
    status: string,
    blocks: Array<{
      id: string,
      showSolutions: boolean,
      timeLimit: number,
      questions: Array<{
        id: string,
        questionDefinition: {
          title: string,
          type: string,
        },
      }>,
    }>,
    createdAt: string,
    updatedAt: string,
  }>,
}
const SessionListQuery = gql`
  {
    sessions: allSessions(orderBy: updatedAt_DESC) {
      id
      name
      status
      blocks {
        id
        showSolutions
        timeLimit
        questions {
          id
          questionDefinition {
            title
            type
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`

// HACK: use the currently logged in user instead of the first of every user
type RunningSessionType = {
  loading: boolean,
  error?: string,
  allUsers: Array<{
    activeSession: {
      confusion: Array<{
        comprehensibility: number,
        difficulty: number,
        createdAt: string,
      }>,
      feedbacks: Array<{
        id: string,
        content: string,
        votes: string,
      }>,
      blocks: Array<{
        id: string,
        status: string,
        questions: Array<{
          id: string,
          questionDefinition: {
            title: string,
            type: string,
          },
        }>,
      }>,
    },
  }>,
}
const RunningSessionQuery = gql`
  {
    allUsers {
      activeSession {
        confusion(orderBy: createdAt_DESC) {
          comprehensibility
          difficulty
          createdAt
        }
        feedbacks(orderBy: votes_DESC) {
          id
          content
          votes
        }
        blocks {
          id
          status
          questions {
            id
            questionDefinition {
              title
              type
            }
          }
        }
      }
    }
  }
`

export { QrGeneratorQuery, QuestionListQuery, RunningSessionQuery, SessionListQuery, TagListQuery }
export type { QrGeneratorType, QuestionListType, RunningSessionType, SessionListType, TagListType }
