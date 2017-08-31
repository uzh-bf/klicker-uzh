// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import SCCreationOptions from './SCCreationOptions'

// create a stateful wrapper for the component
class Wrapper extends Component {
  state = {
    options: [{ correct: true, name: 'Correct option' }, { correct: false, name: 'This is false' }],
  }

  handleNewOption = (option) => {
    this.setState({ options: [...this.state.options, option] })
  }

  render() {
    return <SCCreationOptions options={this.state.options} handleNewOption={this.handleNewOption} />
  }
}

storiesOf('SCCreationOptions', module).add('default', () => <Wrapper />)
