/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import CreateQuestion from '../pages/questions/create'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<CreateQuestion />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
