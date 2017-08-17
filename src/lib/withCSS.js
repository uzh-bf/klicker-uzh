// @flow

import * as React from 'react'
import { Helmet } from 'react-helmet'

import { createLinks } from './utils/css'

function withCSS(WrappedComponent: React.ComponentType<any>, links: Array<string>) {
  const WithCSS = (props: any) =>
    (<div>
      <Helmet>
        {createLinks(links)}
      </Helmet>
      <WrappedComponent {...props} />
    </div>)

  WithCSS.displayName = `WithCSS(${WrappedComponent.displayName || WrappedComponent.name})`

  return WithCSS
}

export default withCSS
