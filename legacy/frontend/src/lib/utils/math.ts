/* eslint-disable no-mixed-operators */

export function toValueArray(data: any[]): any[] {
  return data.reduce((acc, { count, value }): any[] => {
    const elements = Array(count).fill(parseFloat(value))
    return acc.concat(elements)
  }, [])
}
