const TagListQuery = `
  query TagList {
    tags: allTags {
      id
      name
    }
  }
`

const QuestionListQuery = `
  query QuestionList {
    questions: allQuestions {
      id
      title
      type
      instances {
        id
        version
        createdAt
        session
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

const QuestionDetailsQuery = `
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
const QuestionDetailsSerializer = {
  test: ({ question }) => !!question,
  print: ({
    question: {
      title, type, instances, tags, versions,
    },
  }) => `
    question {
      title: ${title}
      type: ${type}
      tags: ${JSON.stringify(tags.map(tag => tag.name))}

      instances: ${instances.length}
      versions: ${versions.map(({ description, options, solution }) => `
        description: ${description}
        options: ${JSON.stringify(options)}
        solution: ${JSON.stringify(solution)}
      `)}
    }
  `,
}

const SessionListQuery = `
  query SessionList {
    sessions: allSessions {
      id
      name
      status
      blocks {
        id
        instances {
          id
          version
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

const RunningSessionQuery = `
  query RunningSession {
    runningSession {
      id
      runtime
      startedAt
      activeStep
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
          version
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
const RunningSessionSerializer = {
  test: ({ runningSession }) => !!runningSession,
  print: ({
    runningSession: {
      activeStep, confusionTS, feedbacks, blocks, settings,
    },
  }) => `
    runningSession {
      activeStep: ${activeStep}
      confusionTS: ${confusionTS.map(({ difficulty, speed }) => `
        difficulty: ${difficulty}
        speed: ${speed}
      `)}
      feedbacks: ${feedbacks.map(({ content, votes }) => `
        content: ${content}
        votes: ${votes}
      `)}
      blocks: ${blocks.map(({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(({ isOpen, question, version }) => `
          isOpen: ${isOpen}
          version: ${version}
          question {
            title: ${question.title}
            type: ${question.type}
          }
        `)}
      `)}
      settings: ${JSON.stringify(settings)}
    }
  `,
}

const AccountSummaryQuery = `
  query AccountSummary {
    user {
      id
      shortname
      runningSession {
        id
        runtime
      }
    }
  }
`

const JoinSessionQuery = `
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
const JoinSessionSerializer = {
  test: ({ joinSession }) => !!joinSession,
  print: ({ joinSession: { settings, activeQuestions, feedbacks } }) => `
    joinSession {
      settings: ${JSON.stringify(settings)}
      activeQuestions: ${activeQuestions.map(({
    title, description, type, options,
  }) => `
        title: ${title}
        description: ${description}
        type: ${type}
        options: ${JSON.stringify(options)}
      `)}
      feedbacks: ${feedbacks.map(({ content, votes }) => `
        content: ${content}
        votes: ${votes}
      `)}
    }
  `,
}

const SessionEvaluationQuery = `
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
const SessionEvaluationSerializer = {
  test: ({ session }) => !!session,
  print: ({ session: { status, blocks } }) => `
    evaluateSession {
      status: ${status}
      blocks: ${blocks.map(({ status: status2, instances }) => `
        status: ${status2}
        instances: ${instances.map(({
    isOpen, version, question, results, responses,
  }) => `
          isOpen: ${isOpen}
          version: ${version}
          question {
            title: ${question.title}
            type: ${question.type}
            versions: ${question.versions.map(({ description, options }) => `
              description: ${description}
              options: ${JSON.stringify(options)}
            `)}
          }
          results: ${JSON.stringify(results)}
          responses: ${responses.map(response => response.value)}
        `)}
      `)}
    }
  `,
}

module.exports = {
  TagListQuery,
  QuestionListQuery,
  QuestionDetailsQuery,
  SessionListQuery,
  RunningSessionQuery,
  AccountSummaryQuery,
  JoinSessionQuery,
  SessionEvaluationQuery,
  serializers: [
    QuestionDetailsSerializer,
    RunningSessionSerializer,
    JoinSessionSerializer,
    SessionEvaluationSerializer,
  ],
}
