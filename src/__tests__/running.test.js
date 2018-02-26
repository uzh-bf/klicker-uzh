/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Running from '../pages/sessions/running'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<Running />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
