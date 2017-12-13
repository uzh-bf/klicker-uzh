/* eslint-disable no-use-before-define */

// https://gist.github.com/Billy-/d94b65998501736bfe6521eadc1ab538

function omitDeep(obj, key) {
  const keys = Object.keys(obj)
  const newObj = {}
  keys.forEach((i) => {
    if (i !== key) {
      const val = obj[i]
      if (Array.isArray(val)) newObj[i] = omitDeepArrayWalk(val, key)
      else if (typeof val === 'object' && val !== null) newObj[i] = omitDeep(val, key)
      else newObj[i] = val
    }
  })
  return newObj
}

function omitDeepArrayWalk(arr, key) {
  return arr.map((val) => {
    if (Array.isArray(val)) return omitDeepArrayWalk(val, key)
    else if (typeof val === 'object' && val !== null) return omitDeep(val, key)
    return val
  })
}

export default omitDeep
