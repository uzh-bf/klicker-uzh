const _round = require('lodash/round')
const _pick = require('lodash/pick')
const _sum = require('lodash/sum')
const _mapValues = require('lodash/mapValues')
const _sumBy = require('lodash/sumBy')

const { QuestionModel, QUESTION_GROUPS } = require('@klicker-uzh/db')

async function computeQuestionStatistics({ ids, userId }) {
  const questions = await QuestionModel.find({
    _id: { $in: ids },
    user: userId,
  }).populate({ path: 'instances' })

  const results = questions
    // prepare the question data for aggregation
    .flatMap((question) => {
      const usageDetails = {}
      const statistics = {}

      question.instances.forEach((instance) => {
        // if the current instance has no results, there is nothing to compute
        if (!instance.results) {
          return
        }

        // initialize an array for all instance results
        // this can later be aggregated into a single result
        if (!statistics[instance.version]) {
          usageDetails[instance.version] = 0
          statistics[instance.version] = []
        }

        // increase the usage count of the current version
        usageDetails[instance.version] += 1

        if (QUESTION_GROUPS.CHOICES.includes(question.type)) {
          if (!instance.results.CHOICES) {
            return
          }
          // add choices to the overall version data
          // map them such that the overall participant count is included
          statistics[instance.version].push(
            instance.results.CHOICES.map((choice) => ({ chosen: choice, total: instance.results.totalParticipants }))
          )
        } else if (QUESTION_GROUPS.FREE.includes(question.type)) {
          if (!instance.results.FREE) {
            return
          }
          // append free responses to the overall version data
          // such that it can later be aggregated easily
          statistics[instance.version] = statistics[instance.version].concat(
            Object.entries(instance.results.FREE).map(([key, value]) => ({ ...value, key }))
          )
        }
      })

      return {
        ..._pick(question, ['id', 'title', 'description', 'type', 'createdAt', 'updatedAt', 'versions']),
        usageDetails,
        statistics,
      }
    })
    // aggregate the prepared version data and compute statistics
    .map((result) => {
      const question = { ...result }

      // calculate the total usage count
      question.usageTotal = _sum(Object.values(question.usageDetails))
      question.usageDetails = Object.entries(question.usageDetails).map(([version, count]) => ({
        version,
        count,
      }))

      if (QUESTION_GROUPS.CHOICES.includes(question.type)) {
        // map the rawData values (choice arrays) and aggregate all the counts
        // additionally include metadata and percentage in the aggregated result
        question.statistics = Object.entries(
          _mapValues(question.statistics, (versionData, version) => {
            return versionData
              .reduce((acc, response) => {
                if (acc.length === 0) {
                  return response.map((choice, index) => ({
                    ...question.versions[version].options[question.type].choices[index],
                    ...choice,
                  }))
                }

                return acc.map((choice, index) => ({
                  ...choice,
                  chosen: choice.chosen + response[index].chosen,
                  total: choice.total + response[index].total,
                }))
              }, [])
              .map((choice) => ({ ...choice, percentageChosen: _round(choice.chosen / choice.total, 2) }))
          })
        ).map(([version, CHOICES]) => ({ version, CHOICES }))
      } else if (QUESTION_GROUPS.FREE.includes(question.type)) {
        // map the rawData values (arrays of free result objects) and aggregate
        // additionally include metadata and percentage in the aggregated result
        question.statistics = Object.entries(
          _mapValues(question.statistics, (versionData, version) => {
            const total = _sumBy(question.statistics[version], 'count')
            return Object.values(
              versionData.reduce((acc, { key, count, value }) => {
                const newCount = acc[key] ? acc[key].chosen + count : count
                return {
                  ...acc,
                  [key]: {
                    chosen: newCount,
                    key,
                    value,
                    total,
                    percentageChosen: _round(newCount / total, 2),
                  },
                }
              }, {})
            )
          })
        ).map(([version, FREE]) => ({ version, FREE }))
      }

      delete question.versions

      return question
    })

  return results
}

module.exports = {
  computeQuestionStatistics,
}
