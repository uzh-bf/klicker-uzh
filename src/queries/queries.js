import { gql } from 'react-apollo'

export const TagListQuery = gql`
  {
    tags: allTags {
      id
      name
    }
  }
`

export const QuestionListQuery = gql`
  {
    questions: allQuestions {
      id
      title
      type
      instances {
        id
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

export const RunningSessionQuery = gql`
  {
    user {
      id
      runningSession {
        id
        feedbacks {
          key
          content
          votes
        }
        blocks {
          key
          status
          instances {
            id
            question {
              id
              title
              type
            }
          }
        }
      }
    }
  }
`

export const RunningSessionSummaryQuery = gql`
  {
    user {
      id
      runningSession {
        id
      }
    }
  }
`
