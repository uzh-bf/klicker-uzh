// @flow

/*
  eslint-disable
  import/no-extraneous-dependencies, import/no-unresolved, import/extensions,
  react/jsx-max-props-per-line, react/jsx-indent-props, react/jsx-first-prop-new-line,
  react/prop-types, react/no-multi-comp
*/

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { arrayMove } from 'react-sortable-hoc'

import TypeChooser from './TypeChooser'
import {
  SCAnswerOptions,
  SCCreationContent,
  SCCreationOptions,
  SCCreationOption,
  SCCreationPlaceholder,
  SCCreationPreview,
} from './SC'

class SCAnswerWrapper extends Component {
  state = {
    activeOption: 1,
  }
  render() {
    return (
      <SCAnswerOptions
        activeOption={this.state.activeOption}
        options={[{ label: 'answer 1' }, { label: 'antwort 2' }, { label: 'option 3' }]}
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

  handleUpdateOrder = ({ oldIndex, newIndex }) => {
    this.setState({
      options: arrayMove(this.state.options, oldIndex, newIndex),
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
        handleUpdateOrder={this.handleUpdateOrder}
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
      handleChange={a => () => {
        console.log(a)
      }}
    />
  ))
  .add('SC Answering Options', () => <SCAnswerWrapper />)
  .add('SC Creation Content', () => <SCCreationContent />)
  .add('SC Creation Options [NoTest]', () => <SCCreationWrapper />)
  .add('SC Creation Option (correct)', () => <SCCreationOption correct name="That's true!" />)
  .add('SC Creation Option (incorrect)', () => (
    <SCCreationOption correct={false} name="So wrong!" />
  ))
  .add('SC Creation Placeholder', () => <SCCreationPlaceholder />)
  .add('SC Creation Preview', () => (
    <SCCreationPreview title="Hello question" description="abcd" options={[]} />
  ))
