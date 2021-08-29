import { useState, useEffect } from 'react'
import localForage from 'localforage'

function useStickyState(defaultValue, key) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const get = async () => {
      try {
        const stickyValue: string = await localForage.getItem(key)
        setValue(stickyValue)
      } catch {
        setValue(defaultValue)
      }
    }
    get()
  }, [])

  useEffect(() => {
    localForage.setItem(key, value)
  }, [key, value])

  return [value, setValue]
}

export default useStickyState
