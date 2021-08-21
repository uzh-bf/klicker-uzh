const _map = require('lodash/map')
const { ensureLoaders } = require('../lib/loaders')
const SessionExecService = require('../services/sessionExec')
const SessionMgrService = require('../services/sessionMgr')
const { getRedis } = require('../redis')
const { QUESTION_GROUPS, SESSION_STATUS } = require('../constants')
const { SessionModel } = require('../models')

const responseCache = getRedis()

/* ----- queries ----- */
const questionInstanceByIDQuery = (_, { id }, { loaders }) => ensureLoaders(loaders).questionInstances.load(id)

const questionInstancesByPVQuery = async (parentValue, args, { loaders }) => {
  const loader = ensureLoaders(loaders).questionInstances
  const instances = await Promise.all(parentValue.instances.map((instance) => loader.load(instance)))
  return instances.filter((instance) => !!instance)
}

const responsesByPVQuery = (parentValue) =>
  parentValue.responses.map(({ id, value, createdAt }) => ({
    id,
    ...value,
    createdAt,
  }))

const resultsByPVQuery = async ({ session, id, isOpen, results }) => {
  if (isOpen) {
    const sessionEntity = await SessionModel.findById(session)

    if (sessionEntity.status === SESSION_STATUS.RUNNING) {
      // extract responses from the redis cache (just-in-time)
      const result = await responseCache
        .pipeline()
        .hgetall(`instance:${id}:info`)
        .hgetall(`instance:${id}:results`)
        .hgetall(`instance:${id}:responseHashes`)
        .exec()
      const { type } = result[0][1]
      const redisResults = result[1][1]
      const responseHashes = result[2][1]

      if (QUESTION_GROUPS.CHOICES.includes(type)) {
        return SessionMgrService.choicesToResults(redisResults)
      }

      if (QUESTION_GROUPS.FREE.includes(type)) {
        const { FREE, totalParticipants } = SessionMgrService.freeToResults(redisResults, responseHashes)
        return {
          FREE: _map(FREE, (val, key) => ({ ...val, key })),
          totalParticipants,
        }
      }
    }
  }

  if (results && results.FREE) {
    return {
      FREE: _map(results.FREE, (result, key) => ({ ...result, key })),
      totalParticipants: results.totalParticipants,
    }
  }

  if (results && results.CHOICES) {
    return results
  }

  return null
}

/* ----- mutations ----- */
const addResponseMutation = async (_, { instanceId, response }, { auth }) => {
  await SessionExecService.addResponse({
    instanceId,
    response,
    auth,
  })

  return 'RESPONSE_ADDED'
}

const deleteResponseMutation = async (_, { instanceId, response }, { auth }) => {
  await SessionExecService.deleteResponse({
    userId: auth.sub,
    instanceId,
    response,
  })

  return 'RESPONSE_DELETED'
}

module.exports = {
  // queries
  questionInstance: questionInstanceByIDQuery,
  questionInstancesByPV: questionInstancesByPVQuery,
  responsesByPV: responsesByPVQuery,
  resultsByPV: resultsByPVQuery,

  // mutations
  addResponse: addResponseMutation,
  deleteResponse: deleteResponseMutation,
}
