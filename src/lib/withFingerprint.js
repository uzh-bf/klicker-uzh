import React from 'react'
import Cookies from 'js-cookie'

export const ensureFingerprint = async fp => {
  let fingerprint = await fp

  if (!fingerprint) {
    const Fingerprint2 = require('fingerprintjs2')
    fingerprint = await new Promise(resolve => {
      new Fingerprint2().get(result => {
        resolve(result)
      })
    })
  }

  return fingerprint
}

export default ComposedComponent => {
  let fingerprint
  if (process.env.SECURITY_FINGERPRINTING && typeof window !== 'undefined') {
    fingerprint = new Promise((resolve, reject) => {
      // if an existing cookie already contains a fingerprint, reuse it
      const existing = Cookies.get('fp')
      if (existing) {
        resolve(existing)
      }

      // otherwise generate a new fingerprint and store it in a cookie
      try {
        const Fingerprint2 = require('fingerprintjs2')

        if (window.requestIdleCallback) {
          requestIdleCallback(() => {
            new Fingerprint2().get(result => {
              Cookies.set('fp', result)
              resolve(result)
            })
          })
        } else {
          setTimeout(() => {
            new Fingerprint2().get(result => {
              Cookies.set('fp', result)
              resolve(result)
            })
          }, 500)
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  const WithFingerpint = props => <ComposedComponent {...props} fp={fingerprint} />

  WithFingerpint.displayName = `WithFingerprint(${ComposedComponent.displayName || ComposedComponent.name})`

  return WithFingerpint
}
