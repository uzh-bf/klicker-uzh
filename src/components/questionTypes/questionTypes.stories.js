/* eslint-disable import/no-extraneous-dependencies, react/no-multi-comp */

import React, { Component } from 'react'
import { storiesOf } from '@storybook/react'
import { intlMock } from '../../../.storybook/utils'

import TypeChooser from './TypeChooser'
import {
  SCAnswerOptions,
  SCCreationContent,
  SCCreationOption,
  SCCreationOptions,
  SCCreationPlaceholder,
  SCCreationPreview,
} from './SC'
import { FREEAnswerOptions, FREECreationPreview } from './FREE'

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

storiesOf('questionTypes/components', module).add('TypeChooser', () => (
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

storiesOf('questionTypes/SC', module)
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

storiesOf('questionTypes/FREE', module)
  .add('FREE Answering Options (unrestricted)', () => (
    <FREEAnswerOptions options={{ restrictions: { max: null, min: null, type: 'NONE' } }} />
  ))
  .add('FREE Answering Options (lower bound restriction)', () => (
    <FREEAnswerOptions options={{ restrictions: { max: null, min: 9, type: 'NUMBERS' } }} />
  ))
  .add('FREE Answering Options (upper bound restriction)', () => (
    <FREEAnswerOptions options={{ restrictions: { max: 87, min: null, type: 'NUMBERS' } }} />
  ))
  .add('FREE Answering Options (Number restriction)', () => (
    <FREEAnswerOptions options={{ restrictions: { max: 87, min: 900, type: 'NUMBERS' } }} />
  ))
  .add('FREE Creation Preview (unrestricted)', () => (
    <FREECreationPreview title="Hello" description="World!" />
  ))
  .add('FREE Creation Preview (Lower bound restriction)', () => (
    <FREECreationPreview
      title="Hello"
      options={{ restrictions: { max: null, min: 90, type: 'NUMBERS' } }}
      description="World!"
    />
  ))
  .add('FREE Creation Preview (Number-Range)', () => (
    <FREECreationPreview
      title="Hello"
      options={{ restrictions: { max: 900, min: 90, type: 'NUMBERS' } }}
      description="World!"
    />
  ))
