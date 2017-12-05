import _maxBy from 'lodash/maxBy'
import _minBy from 'lodash/minBy'

// sort values
export const sortValues = (values) => {
  // create array out of the values and their counts
  const array = values.data.reduce((acc, { count, value }) => {
    const elements = Array(count).fill(parseFloat(value))
    return acc.concat(elements)
  }, [])

  // return sorted array
  return array.sort((a, b) => a - b)
}

// calculate the min using lodas
export const calculateMin = (values) => {
  const minItem = _minBy(values.data, 'value')
  return minItem && minItem.value
}

// calculate the max using lodash
export const calculateMax = (values) => {
  const maxItem = _maxBy(values.data, 'value')
  return maxItem && maxItem.value
}

// calculate the mean using reduce
export const calculateMean = values =>
  // sum all values according their count
  // and divide trough the total count of values
  values.data.reduce((sum, { count, value }) => sum + count * value, 0) / values.totalResponses

// calculate the median using reduce
export const calculateMedian = (values) => {
  const sortedValues = sortValues(values)
  const { length } = sortedValues
  const half = Math.floor(length / 2)

  if (length % 2) {
    return sortedValues[half]
  }

  return (sortedValues[half - 1] + sortedValues[half]) / 2.0
}

// calculate percentile with linear interpolation
// (same as python numpy.percentile with linear interpolation)
// original source:
// https://jsfiddle.net/PBrockmann/der72ot0/
export const calculatePercentile = (values, percentile) => {
  const sorted = sortValues(values)
  const { length } = sorted
  const index = percentile / 100 * (length - 1)

  if (Math.floor(index) === index) {
    // return the value if the index matches exactly
    return sorted[index]
  }
  // return the value of the next smaller index and
  // interpolate the gap to the next larger value
  // linearly
  const i = Math.floor(index)
  return sorted[i] + (sorted[i + 1] - sorted[i]) * (index - i)
}

// calculate the first quartile using percentiles with linear interpolation
export const calculateFirstQuartile = values => calculatePercentile(values, 25)

// calculate the first quartile using percentiles with linear interpolation
export const calculateThirdQuartile = values => calculatePercentile(values, 75)

// calculate the standard deviation using map and reduce
// oiginal source:
// https://derickbailey.com/2014/09/21/calculating-standard-deviation-with-array-map-and-array-reduce-in-javascript/
export const calculateStandardDeviation = (values) => {
  // get the mean and squared differences of all values to the mean
  const mean = calculateMean(values)
  const sqrdDiffs = values.data.map(({ count, value }) => count * (value - mean) ** 2)

  // get the sum of all squared differences
  const sqrdDiffsSum = sqrdDiffs.reduce((sum, value) => sum + value, 0)
  // return the suqare root of the average squared difference to the mean
  return Math.sqrt(sqrdDiffsSum / sqrdDiffs.length)
}
