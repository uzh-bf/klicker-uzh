/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Registration from '../pages/user/registration'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<Registration />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
