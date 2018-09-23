/* eslint-disable no-mixed-operators */

export const toValueArray = data =>
  data.reduce((acc, { count, value }) => {
    const elements = Array(count).fill(parseFloat(value))
    return acc.concat(elements)
  }, [])
