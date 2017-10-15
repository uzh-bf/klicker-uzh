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
        id
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
        id
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
        confusionTS {
          difficulty
          speed
          createdAt
        }
        feedbacks {
          id
          content
          votes
          createdAt
        }
        blocks {
          id
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
        settings {
          isConfusionBarometerActive
          isFeedbackChannelActive
          isFeedbackChannelPublic
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
