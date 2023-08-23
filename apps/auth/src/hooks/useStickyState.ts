import cookie from 'js-cookie'
import localForage from 'localforage'
import { useEffect, useState } from 'react'

function useStickyState(key: string, defaultValue: any) {
  const [hasInitialized, setHasInitialized] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const [stickyValue, setStickyValue] = useState<string | null>(null)

  useEffect(() => {
    const get = async () => {
      try {
        let stickyValue: string | null = await localForage.getItem(key)
        if (!stickyValue) {
          const cookieValue = cookie.get(key)
          if (cookieValue) {
            stickyValue = cookieValue
          }
        }
        setValue(stickyValue ?? defaultValue)

        if (stickyValue) {
          setStickyValue(stickyValue)
        }
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
      cookie.set(key, value, {
        expires: 99999,
      })
    } catch (e) {
      console.error(e)
    }
  }, [key, value])

  return { value, setValue, hasInitialized, stickyValue }
}

export default useStickyState
