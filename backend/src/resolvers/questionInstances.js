const _map = require('lodash/map')

const SessionExecService = require('../services/sessionExec')

/* ----- queries ----- */
const questionInstanceByIDQuery = (parentValue, { id }, { loaders }) => loaders.questionInstances.load(id)
const questionInstancesByPVQuery = (parentValue, args, { loaders }) =>
  loaders.questionInstances.loadMany(parentValue.instances)

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
const addResponseMutation = (parentValue, { fp, instanceId, response }, { ip }) =>
  SessionExecService.addResponse({
    fp,
    ip,
    instanceId,
    response,
  })

module.exports = {
  // queries
  questionInstance: questionInstanceByIDQuery,
  questionInstancesByPV: questionInstancesByPVQuery,
  responsesByPV: responsesByPVQuery,
  resultsByPV: resultsByPVQuery,

  // mutations
  addResponse: addResponseMutation,
}
