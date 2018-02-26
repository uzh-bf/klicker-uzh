/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Index from '../pages/sessions/index'

describe('Snapshot-Testing', () => {
  it('Works', () => {
    const component = renderer.create(<Index />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
