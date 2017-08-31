// @flow

/*
  eslint-disable
  import/no-extraneous-dependencies, import/no-unresolved, import/extensions,
  react/jsx-max-props-per-line, react/jsx-indent-props, react/jsx-first-prop-new-line,
  react/prop-types, react/no-multi-comp
*/

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'

import TypeChooser from './TypeChooser'
import { SCAnswerOptions, SCCreationOptions, SCCreationOption, SCCreationPlaceholder } from './SC'

class SCAnswerWrapper extends Component {
  state = {
    activeOption: 1,
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

  handleDeleteOption = index => () => {
    this.setState({
      options: [...this.state.options.slice(0, index), ...this.state.options.slice(index + 1)],
    })
  }

  handleOptionToggleCorrect = index => () => {
    const option = this.state.options[index]

    this.setState({
      options: [
        ...this.state.options.slice(0, index),
        { ...option, correct: !option.correct },
        ...this.state.options.slice(index + 1),
      ],
    })
  }

  render() {
    return (
      <SCCreationOptions
        options={this.state.options}
        handleNewOption={this.handleNewOption}
        handleDeleteOption={this.handleDeleteOption}
        handleOptionToggleCorrect={this.handleOptionToggleCorrect}
      />
    )
  }
}

storiesOf('QuestionTypes', module)
  .add('TypeChooser', () => (
    <TypeChooser
      activeType="SC"
      types={[
        { name: 'Single Choice', value: 'SC' },
        { name: 'Multiple Choice', value: 'MC' },
        { name: 'Free-Form', value: 'FREE' },
      ]}
    />
  ))
  .add('SC Answering Options', () => <SCAnswerWrapper />)
  .add('SC Creation Options', () => <SCCreationWrapper />)
  .add('SC Creation Option (correct)', () => <SCCreationOption correct name="That's true!" />)
  .add('SC Creation Option (incorrect)', () => (
    <SCCreationOption correct={false} name="So wrong!" />
  ))
  .add('SC Creation Placeholder', () => <SCCreationPlaceholder />)
