import _maxBy from 'lodash/maxBy'
import _minBy from 'lodash/minBy'

// calculate max and min using lodash
export const calculateMax = results => _maxBy(results.data, 'value').value
export const calculateMin = results => _minBy(results.data, 'value').value

// calculate the mean using reduce
export const calculateMean = results =>
  results.data.reduce((acc, { count, value }) => {
    const adder = count * value
    return acc + adder
  }, 0) / results.totalResponses

// calculate the median using reduce
export const calculateMedian = (results) => {
  const sortedValues = Array.sort(
    results.data.reduce((acc, { count, value }) => {
      const filled = Array.fill(+value, count)
      return acc.concat(filled)
    }, []),
  )
  const { length } = sortedValues
  const half = Math.floor(length / 2)

  if (length % 2) {
    return sortedValues[half]
  }

  return (sortedValues[half - 1] + sortedValues[half]) / 2.0
}
