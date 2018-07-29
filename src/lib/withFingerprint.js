import React from 'react'

export default (ComposedComponent) => {
  let fingerprint
  if (process.env.APP_FINGERPRINTING && typeof window !== 'undefined') {
    fingerprint = new Promise((resolve, reject) => {
      // if an existing cookie already contains a fingerprint, reuse it
      const existing = sessionStorage.getItem('fp')
      if (existing) {
        resolve(existing)
      }

      // otherwise generate a new fingerprint and store it in a cookie
      try {
        const Fingerprint2 = require('fingerprintjs2')
        new Fingerprint2().get((result) => {
          sessionStorage.setItem('fp', result)
          resolve(result)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  const WithFingerpint = props => (
    <ComposedComponent {...props} fp={fingerprint} />
  )

  WithFingerpint.displayName = `WithFingerprint(${ComposedComponent.displayName
    || ComposedComponent.name})`

  return WithFingerpint
}
