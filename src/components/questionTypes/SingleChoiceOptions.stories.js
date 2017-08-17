// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { number } from '@storybook/addon-knobs'

import SingleChoiceOptions from './SingleChoiceOptions'

// create a stateful wrapper for the component
class Wrapper extends Component<$FlowFixMeProps, $FlowFixMeState> {
  state = {
    activeOption: -1,
  }
  render() {
    return (
      <SingleChoiceOptions
        activeOption={this.state.activeOption}
        options={this.props.options}
        handleOptionClick={index => () => this.setState({ activeOption: index })}
      />
    )
  }
}

// specify some example options
const options = [
  { label: 'answer2' },
  { label: 'antwort 2' },
  { label: 'option 3' },
  { label: 'tschege' },
]

storiesOf('SingleChoiceOptions', module)
  .add('default', () => <Wrapper options={options} />)
  .add('withActiveOption', () =>
    (<SingleChoiceOptions
      activeOption={number('activeOption', 1)}
      options={options}
      handleOptionClick={index => () => action(`option ${index} clicked`)}
    />),
  )
