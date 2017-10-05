/*
  eslint-disable
  import/no-extraneous-dependencies, import/no-unresolved, import/extensions,
  react/jsx-max-props-per-line, react/jsx-indent-props, react/jsx-first-prop-new-line,
  react/prop-types, react/no-multi-comp
*/

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { intlMock } from '../../../.storybook/utils'

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
        options={[
          { correct: false, name: 'answer 1' },
          { correct: true, name: 'antwort 2' },
          { correct: false, name: 'option 3' },
        ]}
        onOptionClick={index => () => this.setState({ activeOption: index })}
      />
    )
  }
}

class SCCreationWrapper extends Component {
  state = {
    options: [{ correct: true, name: 'Correct option' }, { correct: false, name: 'This is false' }],
  }

  render() {
    return (
      <SCCreationOptions
        input={{
          onChange: options => this.setState({ options }),
          value: this.state.options,
        }}
        intl={intlMock}
      />
    )
  }
}

storiesOf('QuestionTypes', module)
  .add('TypeChooser', () => (
    <TypeChooser
      input={{
        onChange: (a) => {
          console.log(a)
        },
        value: 'SC',
      }}
      intl={intlMock}
      types={[
        { name: 'Single Choice', value: 'SC' },
        { name: 'Multiple Choice', value: 'MC' },
        { name: 'Free-Form', value: 'FREE' },
      ]}
    />
  ))
  .add('SC Answering Options', () => <SCAnswerWrapper />)
  .add('SC Creation Content', () => <SCCreationContent input={{ value: 'hello world' }} />)
  .add('SC Creation Options [NoTest]', () => <SCCreationWrapper />)
  .add('SC Creation Option (correct)', () => <SCCreationOption correct name="That's true!" />)
  .add('SC Creation Option (incorrect)', () => (
    <SCCreationOption correct={false} name="So wrong!" />
  ))
  .add('SC Creation Placeholder', () => <SCCreationPlaceholder />)
  .add('SC Creation Preview', () => (
    <SCCreationPreview title="Hello question" description="abcd" options={[]} />
  ))
