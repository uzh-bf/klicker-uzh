/* eslint-disable react/no-did-mount-set-state */

import React from 'react'

function getComponentDisplayName(Component) {
  return Component.displayName || Component.name || 'Unknown'
}

export default ({
  propName,
  propDefault,
  storageType = 'session',
  json = false,
}) => ComposedComponent =>
  class WithStorage extends React.Component {
    static displayName = `WithStorage(${getComponentDisplayName(ComposedComponent)})`

    constructor(props) {
      super(props)
      this.state = {
        [propName]: propDefault,
      }
    }

    componentWillMount() {
      let data

      if (typeof window !== 'undefined') {
        if (storageType === 'session') {
          data = sessionStorage.getItem(propName)
        } else if (storageType === 'local') {
          data = localStorage.getItem(propName)
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
    }

    render() {
      return <ComposedComponent {...this.props} {...this.state} />
    }
  }
