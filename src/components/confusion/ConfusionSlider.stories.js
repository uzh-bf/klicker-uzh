// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import * as React from 'react'
import { storiesOf } from '@storybook/react'

import ConfusionSlider from './ConfusionSlider'

// create a stateful wrapper for the component
class Wrapper extends React.Component<{}, { value: number }> {
  state = {
    value: 10,
  }
  render() {
    return (
      <ConfusionSlider
        title={<h2>Speed</h2>}
        value={this.state.value}
        handleChange={value => this.setState({ value })}
      />
    )
  }
}

storiesOf('ConfusionSlider', module).add('default', () => <Wrapper />)
