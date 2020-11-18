import Cookies from 'js-cookie'
import { useState } from 'react'

interface Params {
  cookieName: string
  initialValue: string
  expires?: number
  secure?: boolean
  reloadLocation?: boolean
}

// FIXME: refactor to useEffect or similar paradigm for improved handling of side-effects
function useCookie({
  cookieName,
  initialValue,
  expires = 14,
  secure = true,
  reloadLocation = false,
}: Params): [string, any] {
  const [value, setValue] = useState((): string => Cookies.get(cookieName) || initialValue)

  const setCookieValue = (newValue: string): void => {
    Cookies.set(cookieName, newValue, { expires, secure })
    setValue(newValue)

    if (reloadLocation) {
      // eslint-disable-next-line no-restricted-globals
      location.reload()
    }
  }

  return [value, setCookieValue]
}

export default useCookie
