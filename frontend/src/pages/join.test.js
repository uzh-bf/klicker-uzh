/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Join from './join'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<Join url={{ query: { shortname: 'rsc' } }} />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
