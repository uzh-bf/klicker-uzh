import { gql } from 'react-apollo'

// Used in: TagList
export const TagListQuery = gql`
  {
    tags: allTags {
      id
      name
    }
  }
`

// Used in: QuestionList
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

// Used in: SessionList
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

// Used in: RunningSession
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

// Used in: Navbar
export const AccountSummaryQuery = gql`
  {
    user {
      id
      shortname
      runningSession {
        id
      }
    }
  }
`
