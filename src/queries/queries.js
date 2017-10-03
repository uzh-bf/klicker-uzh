// @flow

import { gql } from 'react-apollo'

import type { QuestionBlockType, TagType } from '../types'

export type TagListType = {
  loading: boolean,
  error?: string,
  tags: Array<TagType>,
}
export const TagListQuery = gql`
  {
    tags: allTags {
      id
      name
    }
  }
`

export type QuestionType = {
  id: string,
  title: string,
  type: 'SC' | 'MC' | 'FREE',
  instances: Array<{
    id: string,
    createdAt: string,
  }>,
  tags: Array<TagType>,
  versions: Array<{
    createdAt: string,
  }>,
  createdAt: string,
  updatedAt: string,
}
export type QuestionListType = {
  loading: boolean,
  error?: string,
  questions: QuestionType[],
}
export const QuestionListQuery = gql`
  {
    questions: allQuestions {
      id
      title
      type
      instances {
        createdAt
      }
      tags {
        id
        name
      }
      versions {
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`

export type QrGeneratorType = {
  loading: boolean,
  error?: string,
  user: {
    shortname: string,
  },
}
export const QrGeneratorQuery = gql`
  {
    user {
      shortname
    }
  }
`

export type SessionListType = {
  loading: boolean,
  error?: string,
  sessions: Array<{
    id: string,
    name: string,
    status: 'CREATED' | 'RUNNING' | 'COMPLETED',
    blocks: QuestionBlockType[],
    createdAt: string,
    updatedAt: string,
  }>,
}
export const SessionListQuery = gql`
  {
    sessions: allSessions {
      id
      name
      status
      blocks {
        instances {
          id
          question {
            id
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
export type RunningSessionType = {
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
        votes: number,
      }>,
      blocks: QuestionBlockType[],
    },
  }>,
}
export const RunningSessionQuery = gql`
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
          instances {
            id
            question {
              title
              type
            }
          }
        }
      }
    }
  }
`
