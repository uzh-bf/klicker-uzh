/* eslint-env jest */

import * as React from 'react'
import renderer from 'react-test-renderer'

import Session from './session'

// HACK: workaround for https://github.com/Semantic-Org/Semantic-UI-React/issues/1702
jest.mock('react-dom', () => ({
  findDOMNode: jest.fn(() => {}),
}))

describe('Snapshot-Testing', () => {
  it.skip('Works', () => {
    const component = renderer.create(<Session />)
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
