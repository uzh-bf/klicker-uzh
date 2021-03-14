/* eslint-disable react/no-did-mount-set-state */

import Cookies from 'js-cookie'
import React from 'react'

function getComponentDisplayName(Component): string {
  return Component.displayName || Component.name || 'Unknown'
}

export default ({ propName, propDefault, storageType = 'session', json = false }) => (ComposedComponent): any =>
  class WithStorage extends React.Component {
    static displayName = `WithStorage(${getComponentDisplayName(ComposedComponent)})`

    constructor(props) {
      super(props)
      this.state = {
        [propName]: propDefault,
      }
    }

    componentDidMount(): void {
      let data

      try {
        if (typeof window !== 'undefined') {
          if (storageType === 'session' && sessionStorage) {
            data = sessionStorage.getItem(propName)
          } else if (storageType === 'local' && localStorage) {
            data = localStorage.getItem(propName)
          } else if (storageType === 'cookie') {
            data = Cookies.get(propName)
          }

          if (!data) {
            throw new Error('NO_STORAGE_AVAILABLE')
          }

          if (json) {
            data = JSON.parse(data)
          }

          this.setState((prevState) => {
            if (prevState[propName] === data) {
              return undefined
            }

            return {
              [propName]: data,
            }
          })
        }
      } catch (e) {
        console.error(e)
      }
    }

    render(): React.ReactElement {
      return <ComposedComponent {...this.props} {...this.state} />
    }
  }
