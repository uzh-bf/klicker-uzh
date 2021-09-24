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

function useLogging(cfg = {}): void {
  useEffect((): void => {
    if (window.INIT) {
      return
    }

    // merge default and passed config
    const config = {
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

      window.INIT = true
    }
  }, [cfg])
}

export default useLogging
