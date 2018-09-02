const _map = require('lodash/map')
const { ensureLoaders } = require('../lib/loaders')
const SessionExecService = require('../services/sessionExec')

/* ----- queries ----- */
const questionInstanceByIDQuery = (parentValue, { id }, { loaders }) =>
  ensureLoaders(loaders).questionInstances.load(id)

const questionInstancesByPVQuery = async (parentValue, args, { loaders }) => {
  const instances = await ensureLoaders(loaders).questionInstances.loadMany(parentValue.instances)
  return instances.filter(instance => !!instance)
}

const responsesByPVQuery = parentValue =>
  parentValue.responses.map(({ id, value, createdAt }) => ({
    id,
    ...value,
    createdAt,
  }))

const resultsByPVQuery = ({ results }) => {
  if (results && results.FREE) {
    return {
      FREE: _map(results.FREE, (result, key) => ({ ...result, key })),
      totalParticipants: results.totalParticipants,
    }
  }

  if (results && results.CHOICES) {
    return {
      CHOICES: results.CHOICES,
      totalParticipants: results.totalParticipants,
    }
  }

  return null
}

/* ----- mutations ----- */
const addResponseMutation = async (parentValue, { fp, instanceId, response }, { ip }) => {
  await SessionExecService.addResponse({
    fp,
    ip,
    instanceId,
    response,
  })

  return 'RESPONSE_ADDED'
}

const deleteResponseMutation = async (parentValue, { instanceId, response }, { auth }) => {
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
