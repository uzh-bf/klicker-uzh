import { useEffect } from 'react'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

const isProd = process.env.NODE_ENV === 'production'

let LogRocket
let LogRocketReact

if (isProd && publicRuntimeConfig.logrocketAppID) {
  LogRocket = require('logrocket')
  LogRocketReact = require('logrocket-react')
}

declare global {
  interface Window {
    INIT?: boolean
    INIT_LR?: boolean
    INIT_SLAASK?: boolean
    _slaask?: any
  }
}

function useLogging(cfg = {}): void {
  useEffect((): void => {
    if (window.INIT) {
      return
    }

    // merge default and passed config
    const config = {
      slaask: false,
      logRocket: true,
      ...cfg,
    }

    if (isProd) {
      // embed logrocket if enabled
      if (publicRuntimeConfig.logrocketAppID && config.logRocket && !window.INIT_LR) {
        LogRocket.init(publicRuntimeConfig.logrocketAppID)
        LogRocketReact(LogRocket)

        // if (Raven && window.INIT_RAVEN) {
        //   Raven.setDataCallback((data): any => ({
        //     ...data,
        //     extra: {
        //       sessionURL: LogRocket.sessionURL, // eslint-disable-line no-undef
        //     },
        //   }))
        // }

        window.INIT_LR = true
      }

      // embed slaask if enabled
      if (publicRuntimeConfig.slaaskWidgetKey && config.slaask && !window.INIT_SLAASK) {
        try {
          // eslint-disable-next-line no-underscore-dangle
          window._slaask.init(publicRuntimeConfig.slaaskWidgetKey)
        } catch (e) {
          console.error(e)
        }

        window.INIT_SLAASK = true
      }

      window.INIT = true
    }
  }, [])
}

export default useLogging
