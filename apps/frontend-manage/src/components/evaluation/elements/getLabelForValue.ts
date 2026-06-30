type CriterionLabelSource = {
  id?: string
  name?: string
  labels?: {
    min: string
    mid?: string | null
    max: string
  } | null
}

function getLabelForValue(
  value: number,
  criterion: CriterionLabelSource | undefined,
  lower: number,
  upper: number,
  rangeMode?: boolean
) {
  if (!criterion?.labels?.min || !criterion?.labels?.max) {
    return value.toFixed(2)
  }

  const min = criterion.labels.min
  const max = criterion.labels.max
  const mid = criterion.labels.mid
  const midpoint = (lower + upper) / 2

  // return the label closest to the value
  if (mid) {
    if (value <= (lower + midpoint) / 2) {
      if (rangeMode && value !== lower) {
        return `${min} - ${mid}`
      }

      return min
    } else if (value <= (midpoint + upper) / 2) {
      if (rangeMode && value < midpoint) {
        return `${min} - ${mid}`
      } else if (rangeMode && value > midpoint) {
        return `${mid} - ${max}`
      }

      return mid
    } else {
      if (rangeMode && value !== upper) {
        return `${mid} - ${max}`
      }

      return max
    }
  } else {
    if (value <= midpoint) {
      return min
    } else {
      return max
    }
  }
}

export default getLabelForValue
