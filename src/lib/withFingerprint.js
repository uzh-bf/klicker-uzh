import React from 'react'
import Cookies from 'js-cookie'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

const computeFp = (resolve, setCookie = true) => {
  const Fingerprint2 = require('fingerprintjs2')
  Fingerprint2.get({}, components => {
    const values = components.map(component => component.value)
    const murmur = Fingerprint2.x64hash128(values.join(''), 31)

    if (setCookie) {
      Cookies.set('fp', murmur)
    }

    resolve(murmur)
  })
}

export const ensureFingerprint = async fp => {
  let fingerprint = await fp

  if (!fingerprint) {
    fingerprint = await new Promise(resolve => {
      computeFp(resolve, false)
    })
  }

  return fingerprint
}

export default ComposedComponent => {
  let fingerprint
  if (publicRuntimeConfig.withFingerprinting && typeof window !== 'undefined') {
    fingerprint = new Promise((resolve, reject) => {
      // if an existing cookie already contains a fingerprint, reuse it
      const existing = Cookies.get('fp')
      if (existing) {
        resolve(existing)
      }

      // otherwise generate a new fingerprint and store it in a cookie
      try {
        if (window.requestIdleCallback) {
          requestIdleCallback(() => computeFp(resolve))
        } else {
          setTimeout(() => computeFp(resolve), 500)
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
