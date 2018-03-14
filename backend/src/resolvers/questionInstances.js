const _map = require('lodash/map')
const { ensureLoaders } = require('../lib/utils')
const SessionExecService = require('../services/sessionExec')

/* ----- queries ----- */
const questionInstanceByIDQuery = (parentValue, { id }, { loaders }) =>
  ensureLoaders(loaders).questionInstances.load(id)

const questionInstancesByPVQuery = (parentValue, args, { loaders }) =>
  ensureLoaders(loaders).questionInstances.loadMany(parentValue.instances)

const responsesByPVQuery = parentValue =>
  parentValue.responses.map(({ id, value, createdAt }) => ({ id, ...value, createdAt }))

const resultsByPVQuery = ({ results }) => {
  if (results && results.FREE) {
    return {
      FREE: _map(results.FREE, (result, key) => ({ ...result, key })),
    }
  }

  if (results && results.CHOICES) {
    return {
      CHOICES: results.CHOICES,
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

module.exports = {
  // queries
  questionInstance: questionInstanceByIDQuery,
  questionInstancesByPV: questionInstancesByPVQuery,
  responsesByPV: responsesByPVQuery,
  resultsByPV: resultsByPVQuery,

  // mutations
  addResponse: addResponseMutation,
}
