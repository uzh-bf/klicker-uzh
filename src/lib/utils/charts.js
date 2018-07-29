// import _round from 'lodash/round'

import {
  // QUESTION_TYPES,
  SMALL_BAR_THRESHOLD,
  SMALL_PIE_THRESHOLD,
  CHART_TYPES,
} from '../../constants'

// convert an integer index into letters
export function indexToLetter(index) {
  // calculate how many times the letter should be repeated
  // eg. 0 => A (times= 1), 24 => AA (times = 2),
  const n = Math.floor(index / 26) + 1

  // index: letter
  // 65: A, 66: B , ...
  // return n times a letter from A to Z
  return Array(n + 1).join(String.fromCharCode(65 + (index % 26)))
}

// determine whether the label (A,B, ...) is displayed within the bar or not
export function getLabelIn(
  chartType,
  questionType,
  count,
  totalResponses,
  index,
) {
  if (chartType === CHART_TYPES.BAR_CHART) {
    if (count / totalResponses > SMALL_BAR_THRESHOLD) {
      return count
    }
  }

  if (chartType === CHART_TYPES.PIE_CHART) {
    if (count / totalResponses > SMALL_PIE_THRESHOLD) {
      return `${indexToLetter(index)}`
    }
  }

  return ''
}

// determine whether the label (A,B, ...) is displayed outside the bar or not
export function getLabelOut(
  chartType,
  questionType,
  count,
  totalResponses,
  index,
) {
  if (chartType === CHART_TYPES.BAR_CHART) {
    if (count / totalResponses <= SMALL_BAR_THRESHOLD) {
      return count
    }

    return ''
  }

  if (chartType === CHART_TYPES.PIE_CHART) {
    if (count / totalResponses <= SMALL_PIE_THRESHOLD) {
      return `${count} (${indexToLetter(index)})`
    }

    return count
  }

  return ''
}
