// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import SingleChoiceOptions from '../src/components/questionTypes/options/SingleChoiceOptions'


class SCWrapper extends Component {
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

storiesOf('SingleChoiceOptions', module).add('default', () =>
  (<SCWrapper
    options={[
      { label: 'answer1' },
      { label: 'antwort 2' },
      { label: 'option 3' },
      { label: 'tschege' },
    ]}
  />),
)
