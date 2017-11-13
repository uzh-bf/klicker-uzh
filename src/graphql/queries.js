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
        description
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
          isOpen
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

export const ActiveInstancesQuery = gql`
  {
    activeInstances {
      id
      isOpen
      version
      responses {
        id
        value
        createdAt
      }
      results {
        ... on SCQuestionResults {
          choices
        }
        ... on FREEQuestionResults {
          free {
            count
            key
            value
          }
        }
      }
      question {
        id
        title
        type
        versions {
          description
          options {
            ... on SCQuestionOptions {
              choices {
                correct
                name
              }
            }
            ... on FREEQuestionOptions {
              restrictions {
                min
                max
                type
              }
            }
          }
        }
      }
    }
  }
`

export const JoinSessionQuery = gql`
  query JoinSession($shortname: String!) {
    joinSession(shortname: $shortname) {
      id
      settings {
        isFeedbackChannelActive
        isFeedbackChannelPublic
        isConfusionBarometerActive
      }
      activeQuestions {
        id
        instanceId
        title
        description
        type
        options {
          ... on FREEQuestionOptions {
            restrictions {
              min
              max
              type
            }
          }
          ... on SCQuestionOptions {
            choices {
              correct
              name
            }
          }
        }
      }
      feedbacks {
        id
        content
        votes
      }
    }
  }
`
