import { gql } from 'react-apollo'

const TagListQuery = gql`
  {
    tags: allTags(orderBy: name_ASC) {
      id
      name
    }
  }
`

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
const QrGeneratorQuery = gql`
  {
    user {
      shortname
    }
  }
`

const SessionListQuery = gql`
  {
    sessions: allSessions(orderBy: updatedAt_DESC) {
        id
        name
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

/* const RunningSessionQuery = gql`
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
` */

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
