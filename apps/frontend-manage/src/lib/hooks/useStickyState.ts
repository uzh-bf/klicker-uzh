import localForage from 'localforage'
import { useEffect, useState } from 'react'

function useStickyState(defaultValue: boolean, key: string) {
  const [hasInitialized, setHasInitialized] = useState(false)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const get = async () => {
      try {
        const stickyValue = await localForage.getItem(key) as boolean
        setValue(stickyValue)
      } catch {
        setValue(defaultValue)
      } finally {
        setHasInitialized(true)
      }
    }
    get()
  }, [defaultValue, key])

  useEffect(() => {
    try {
      localForage.setItem(key, value)
    } catch (e) {
      console.error(e)
    }
  }, [key, value])

  return [value, setValue, hasInitialized]
}

export default useStickyState
