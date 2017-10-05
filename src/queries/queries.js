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

export const QrGeneratorQuery = gql`
  {
    user {
      shortname
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
