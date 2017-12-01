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

export const QuestionDetailsQuery = gql`
  query QuestionDetails($id: ID!) {
    question(id: $id) {
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
        options {
          SC {
            choices {
              correct
              name
            }
          }
          MC {
            choices {
              correct
              name
            }
          }
          FREE_RANGE {
            restrictions {
              min
              max
            }
          }
        }
        solution {
          SC
          MC
          FREE
          FREE_RANGE
        }
      }
      createdAt
      updatedAt
    }
  }
`

// Used in: SessionList
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
          FREE_RANGE {
            restrictions {
              min
              max
            }
          }
          SC {
            choices {
              correct
              name
            }
            randomized
          }
          MC {
            choices {
              correct
              name
            }
            randomized
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

export const SessionEvaluationQuery = gql`
  query EvaluateSession($sessionId: ID!) {
    session(id: $sessionId) {
      id
      status
      blocks {
        id
        status
        instances {
          id
          isOpen
          version
          question {
            id
            title
            type
            versions {
              description
              options {
                FREE_RANGE {
                  restrictions {
                    min
                    max
                  }
                }
                SC {
                  choices {
                    correct
                    name
                  }
                  randomized
                }
                MC {
                  choices {
                    correct
                    name
                  }
                  randomized
                }
              }
            }
          }
          results {
            ... on SCQuestionResults {
              CHOICES
            }
            ... on FREEQuestionResults {
              FREE {
                count
                key
                value
              }
            }
          }
          responses {
            id
            value
            createdAt
          }
        }
      }
    }
  }
`
