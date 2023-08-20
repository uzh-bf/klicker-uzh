import localForage from 'localforage'
import { useEffect, useState } from 'react'

function useStickyState(key: string, defaultValue: any) {
  const [hasInitialized, setHasInitialized] = useState(false)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const get = async () => {
      try {
        const stickyValue: string | null = await localForage.getItem(key)
        setValue(stickyValue ?? defaultValue)
      } catch {
        setValue(defaultValue)
      } finally {
        setHasInitialized(true)
      }
    }
    get()
  }, [])

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
