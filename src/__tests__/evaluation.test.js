/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import Evaluation from '../pages/sessions/evaluation'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<Evaluation />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
