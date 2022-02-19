import { useState, useEffect } from 'react'
import Cookies from 'js-cookie'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

function computeFingerprint(resolve, setCookie = true): void {
  const Fingerprint2 = import('@fingerprintjs/fingerprintjs')
  Fingerprint2.get({}, (components): void => {
    const values = components.map((component): any => component.value)
    const murmur = Fingerprint2.x64hash128(values.join(''), 31)

    if (setCookie) {
      Cookies.set('fp', murmur)
    }

    resolve(murmur)
  })
}

function useFingerprint(): string {
  const [fingerprint, setFingerprint] = useState(null)

  useEffect((): void => {
    if (publicRuntimeConfig.withFingerprinting) {
      // if an existing cookie already contains a fingerprint, reuse it
      const existing = Cookies.get('fp')
      if (existing) {
        setFingerprint(existing)
      }

      // otherwise generate a new fingerprint and store it in a cookie
      try {
        if (window.requestIdleCallback) {
          window.requestIdleCallback((): void => computeFingerprint(setFingerprint))
        } else {
          setTimeout((): void => computeFingerprint(setFingerprint), 500)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }, [])

  return fingerprint
}

export default useFingerprint
