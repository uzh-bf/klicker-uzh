const md5 = require('md5')

const { QuestionInstanceModel, UserModel } = require('../models')
const { QuestionGroups, QuestionTypes } = require('../constants')

const { getRunningSession } = require('./sessionMgr')

// add a new feedback to a session
const addFeedback = async ({ sessionId, content }) => {
  // TODO: security
  // TODO: rate limiting
  // TODO: ...

  const session = await getRunningSession(sessionId)

  // if the feedback channel is not activated, do not allow new additions
  if (!session.settings.isFeedbackChannelActive) {
    throw new Error('SESSION_FEEDBACKS_DEACTIVATED')
  }

  // push a new feedback into the array
  session.feedbacks.push({ content })

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// delete a feedback from a session
const deleteFeedback = async ({ sessionId, feedbackId, userId }) => {
  const session = await getRunningSession(sessionId)

  // ensure the user is authorized to modify this session
  if (!session.user.equals(userId)) {
    throw new Error('UNAUTHORIZED')
  }

  session.feedbacks = session.feedbacks.filter(feedback => feedback.id !== feedbackId)

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// add a new confusion timestep to the session
const addConfusionTS = async ({ sessionId, difficulty, speed }) => {
  // TODO: security
  // TODO: rate limiting
  // TODO: ...

  const session = await getRunningSession(sessionId)

  // if the confusion barometer is not activated, do not allow new additions
  if (!session.settings.isConfusionBarometerActive) {
    throw new Error('SESSION_CONFUSION_DEACTIVATED')
  }

  // push a new timestep into the array
  session.confusionTS.push({ difficulty, speed })

  // save the updated session
  await session.save()

  // return the updated session
  return session
}

// add a response to an active question instance
const addResponse = async ({ instanceId, response }) => {
  // find the specified question instance
  // only find instances that are open
  const instance = await QuestionInstanceModel.findOne({ _id: instanceId, isOpen: true }).populate('question')

  // if the instance is closed, don't allow adding any responses
  if (!instance) {
    throw new Error('INSTANCE_CLOSED')
  }

  const questionType = instance.question.type
  const currentVersion = instance.question.versions[instance.version]

  // result parsing for SC/MC questions
  if (QuestionGroups.CHOICES.includes(questionType)) {
    // if the response doesn't contain any valid choices, throw
    if (!response.choices || !response.choices.length > 0) {
      throw new Error('INVALID_RESPONSE')
    }

    // if the response contains multiple choices for an MC question
    if (questionType === QuestionTypes.SC && response.choices.length > 1) {
      throw new Error('TOO_MANY_CHOICES')
    }

    // if it is the very first response, initialize results
    if (!instance.results) {
      instance.results = {
        CHOICES: new Array(currentVersion.options[questionType].choices.length).fill(+0),
      }
    }

    // for each choice given, update the results
    response.choices.forEach((responseIndex) => {
      instance.results.CHOICES[responseIndex] += 1
    })
    instance.markModified('results.CHOICES')
  } else if (QuestionGroups.FREE.includes(questionType)) {
    if (!response.value) {
      throw new Error('INVALID_RESPONSE')
    }

    if (
      questionType === QuestionTypes.FREE_RANGE &&
      (response.value < currentVersion.options.FREE_RANGE.restrictions.min ||
        response.value > currentVersion.options.FREE_RANGE.restrictions.max)
    ) {
      throw new Error('RESPONSE_OUT_OF_RANGE')
    }

    // if it is the very first response, initialize results
    if (!instance.results) {
      instance.results = {
        FREE: {},
      }
    }

    // hash the response value to get a unique identifier
    const resultKey = md5(response.value)

    // if the respective response value was not given before, add it anew
    if (!instance.results.FREE[resultKey]) {
      instance.results.FREE[resultKey] = {
        count: 1,
        value: response.value,
      }
    } else {
      // if the response value already occurred, simply increment count
      instance.results.FREE[resultKey].count += 1
    }
    instance.markModified('results.FREE')
  }

  // push the new response into the array
  // TODO: redis for everything in here...
  // TODO: save the IP and fingerprint of the responder and validate
  instance.responses.push({
    ip: 'some ip',
    fingerprint: 'some fingerprint',
    value: response,
  })

  // save the updated instance
  await instance.save()

  // return the updated instance
  return instance
}

const joinSession = async ({ shortname }) => {
  // TODO: add test
  // find the user with the given shortname
  const user = await UserModel.findOne({ shortname }).populate([
    {
      path: 'runningSession',
      populate: {
        path: 'activeInstances',
        populate: {
          path: 'question',
        },
      },
    },
  ])

  const {
    id, activeInstances, settings, feedbacks,
  } = user.runningSession

  return {
    id,
    settings,
    // map active instances to be in the correct format
    activeQuestions: activeInstances.map((instance) => {
      const { id: instanceId, question } = instance
      const version = question.versions[instance.version]

      return {
        id: question.id,
        instanceId,
        title: question.title,
        type: question.type,
        description: version.description,
        options: version.options,
      }
    }),
    feedbacks: settings.isFeedbackChannelActive && settings.isFeedbackChannelPublic ? feedbacks : null,
  }
}

module.exports = {
  getRunningSession,
  addResponse,
  addConfusionTS,
  addFeedback,
  deleteFeedback,
  joinSession,
}
