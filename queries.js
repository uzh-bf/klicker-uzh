import { gql } from 'react-apollo'

const TagList = gql`
  {
    allTags {
      id
      name
    }
  }
`

const QuestionList = gql`
  {
    allQuestionDefinitions {
      id
      title
      evaluations {
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
const QrGenerator = gql`
  {
    user {
      shortname
    }
  }
`

const SessionHistory = gql`
  {
    allSessions {
      id
      name
      status
      questions {
        id
        description
        questionDefinition {
          title
          type
        }
      }
      createdAt
      updatedAt
    }
  }
`

const RunningSession = gql`
  {
    user {
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
        questions {
          id
          description
          questionDefinition {
            title
          }
        }
      }
    }
  }
`

export { QrGenerator, QuestionList, RunningSession, SessionHistory, TagList }
