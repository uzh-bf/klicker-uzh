/* eslint-disable no-use-before-define */

// https://gist.github.com/Billy-/d94b65998501736bfe6521eadc1ab538

export function omitDeep(obj, key): any {
  const keys = Object.keys(obj)
  const newObj = {}
  keys.forEach((i): void => {
    if (i !== key) {
      const val = obj[i]
      if (Array.isArray(val)) newObj[i] = omitDeepArrayWalk(val, key)
      else if (typeof val === 'object' && val !== null) newObj[i] = omitDeep(val, key)
      else newObj[i] = val
    }
  })
  return newObj
}

export function omitDeepArray(arr, key): any[] {
  return arr.map((obj): any => omitDeep(obj, key))
}

export function omitDeepArrayWalk(arr, key): any[] {
  return arr.map((val): any => {
    if (Array.isArray(val)) return omitDeepArrayWalk(val, key)
    if (typeof val === 'object' && val !== null) return omitDeep(val, key)
    return val
  })
}
