import React from 'react'

export default (ComposedComponent) => {
  const WithSorting = props => <ComposedComponent {...props} sortAscending sortBy="bla" />

  WithSorting.displayName = `WithFingerprint(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return WithSorting
}
