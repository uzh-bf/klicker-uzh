import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import Redis from 'ioredis'
const md5 = require('md5')
const v8n = require('v8n')
const _trim = require('lodash/trim')
const { v5: uuidv5 } = require('uuid')

const SESSION_STORAGE_MODE = {
  SECRET: 'SECRET',
  COMPLETE: 'COMPLETE',
}

const QUESTION_TYPES = {
  SC: 'SC',
  MC: 'MC',
  FREE: 'FREE',
  FREE_RANGE: 'FREE_RANGE',
}

const QUESTION_GROUPS = {
  CHOICES: [QUESTION_TYPES.SC, QUESTION_TYPES.MC],
  FREE: [QUESTION_TYPES.FREE, QUESTION_TYPES.FREE_RANGE],
  WITH_OPTIONS: [
    QUESTION_TYPES.SC,
    QUESTION_TYPES.MC,
    QUESTION_TYPES.FREE_RANGE,
  ],
}

const computeParticipantIdentifier = (authToken, namespace) => {
  if (
    typeof authToken === 'undefined' ||
    typeof authToken.sub === 'undefined'
  ) {
    return null
  }

  if (authToken.aai) {
    if (typeof namespace === 'undefined') {
      return null
    }

    return uuidv5(authToken.sub, namespace)
  }

  return authToken.sub
}

const httpTrigger = async function (context, req) {
  if (!req.body) {
    throw new Error('MISSING_RESPONSE_BODY')
  }

  const { instanceId, authToken, response } = req.body

  if (!instanceId || !response) {
    throw new Error('MISSING_PARAMETERS')
  }

  const client = new Redis(process.env.REDIS_URL)

  const instanceKey = `instance:${instanceId}`

  // extract important instance information from the corresponding redis hash
  const { auth, status, type, min, max, mode, namespace } =
    await client.hgetall(`${instanceKey}:info`)

  console.log(auth, status, type, min, max, mode, namespace)

  // ensure that the instance targeted is actually running
  // this approach allows us to not have to fetch the instance from the database at all
  if (status !== 'OPEN') {
    throw new Error('INSTANCE_CLOSED')
  }

  // prepare a redis transaction pipeline to batch all actions into an atomic transaction
  const transaction = client.multi()

  // if authentication is enabled for the session with the current instance
  // check if the current participant has already responded and exit early if so
  if (auth === 'true') {
    const participantIdentifier = computeParticipantIdentifier(
      authToken,
      namespace
    )

    // ensure that a participant id is available (i.e., the participant has logged in)
    if (!participantIdentifier) {
      throw new Error('MISSING_PARTICIPANT_ID')
    }

    // ensure that the participant has not already voted
    const isAuthorizedToVote = await client.sismember(
      `${instanceKey}:participantList`,
      participantIdentifier
    )
    const hasAlreadyVoted = await client.sismember(
      `${instanceKey}:participants`,
      participantIdentifier
    )
    if (!isAuthorizedToVote || hasAlreadyVoted) {
      // if we are using authentication and the responses should be stored
      if (mode === SESSION_STORAGE_MODE.COMPLETE) {
        await client.rpush(
          `${instanceKey}:dropped`,
          JSON.stringify({ response, participant: participantIdentifier })
        )
      }
      throw new Error('RESPONSE_NOT_ALLOWED')
    }

    // add the participant to the set of participants that have voted
    transaction.sadd(`${instanceKey}:participants`, participantIdentifier)
  }

  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    // if the response doesn't contain any valid choices, throw
    if (!response.choices || !(response.choices.length > 0)) {
      throw new Error('INVALID_RESPONSE')
    }

    // if the response contains multiple choices for a SC question
    if (type === QUESTION_TYPES.SC && response.choices.length > 1) {
      throw new Error('TOO_MANY_CHOICES')
    }

    // for each choice in the response, increment the corresponding hash key
    response.choices.forEach((choiceIndex) => {
      transaction.hincrby(`${instanceKey}:results`, choiceIndex, 1)
    })
  } else if (QUESTION_GROUPS.FREE.includes(type)) {
    // validate that a response value has been passed and that it is not extremely long
    if (!response.value || response.value.length > 1000) {
      throw new Error('INVALID_RESPONSE')
    }

    let resultKey
    let resultValue

    // validate whether the numerical answer respects the defined ranges
    if (type === QUESTION_TYPES.FREE_RANGE) {
      // create a new base validator
      // disallow NaN by passing false
      const baseValidator = v8n().number(false)

      try {
        baseValidator.check(+response.value)
      } catch (e) {
        throw new Error('INVALID_RESPONSE')
      }

      let rangeValidator = baseValidator
      if (min) {
        rangeValidator = rangeValidator.greaterThanOrEqual(min)
      }
      if (max) {
        rangeValidator = rangeValidator.lessThanOrEqual(max)
      }

      try {
        rangeValidator.check(+response.value)
      } catch (e) {
        throw new Error('RESPONSE_OUT_OF_RANGE')
      }

      // hash the response value to get a unique identifier
      resultValue = response.value
      resultKey = md5(resultValue)
    } else {
      if (response.length === 0) {
        throw new Error('RESPONSE_EMPTY')
      }

      // hash the response value to get a unique identifier
      resultValue = _trim(response.value.toLowerCase())
      resultKey = md5(resultValue)
    }

    // hash the open response value and add it to the redis hash
    // or increment if the hashed value already exists in the cache
    transaction.hincrby(`${instanceKey}:results`, resultKey, 1)

    // cache the response value <-> hash mapping
    transaction.hset(`${instanceKey}:responseHashes`, resultKey, resultValue)
  }

  if (mode === SESSION_STORAGE_MODE.COMPLETE) {
    transaction.rpush(
      `${instanceKey}:responses`,
      JSON.stringify({
        response,
        participant: authToken ? authToken.sub : undefined,
      })
    )
  }

  // increment the number of participants by one
  transaction.hincrby(`${instanceKey}:results`, 'participants', 1)

  // as we are based on redis, leave early (no db access at all)
  await transaction.exec()

  context.res = {
    // status: 200, /* Defaults to 200 */
    body: 'success',
  }
}

export default httpTrigger
