/* eslint-env jest */

import React from 'react'
import renderer from 'react-test-renderer'

import QuestionDetails from './details'

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<QuestionDetails />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
