import { gql } from 'react-apollo'

export const TagListQuery = gql`
  query TagList {
    tags: allTags {
      id
      name
    }
  }
`

export const QuestionListQuery = gql`
  query QuestionList {
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

export const SessionListQuery = gql`
  query SessionList {
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

export const RunningSessionQuery = gql`
  query RunningSession {
    runningSession {
      id
      runtime
      startedAt
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

export const AccountSummaryQuery = gql`
  query AccountSummary {
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
  query ActiveInstances {
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
