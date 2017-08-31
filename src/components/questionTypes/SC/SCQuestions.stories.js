// @flow

/*
  eslint-disable
  import/no-extraneous-dependencies, import/no-unresolved, import/extensions,
  react/jsx-max-props-per-line, react/jsx-indent-props, react/jsx-first-prop-new-line,
  react/prop-types, react/no-multi-comp
*/

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import SCAnswerOptions from './SCAnswerOptions'
import SCCreationOptions from './SCCreationOptions'
import PlaceholderInput from './PlaceholderInput'

class SCAnswerWrapper extends Component {
  state = {
    activeOption: -1,
  }
  render() {
    return (
      <SCAnswerOptions
        activeOption={this.state.activeOption}
        options={[
          { label: 'answer2' },
          { label: 'antwort 2' },
          { label: 'option 3' },
          { label: 'tschege' },
        ]}
        handleOptionClick={index => () => this.setState({ activeOption: index })}
      />
    )
  }
}

class SCCreationWrapper extends Component {
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

storiesOf('SCQuestions', module)
  .add('SCAnswerOptions', () => <SCAnswerWrapper />)
  .add('SCCreationOptions', () => <SCCreationWrapper />)
  .add('PlaceholderInput', () => (
    <PlaceholderInput
      handleSave={({ correct, name }) =>
        action(`Added new option: correct=${correct ? 'true' : 'false'}, name=${name}`)}
    />
  ))
