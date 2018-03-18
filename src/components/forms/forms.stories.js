/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import { intlMock } from '../../../.storybook/utils'

import {
  FormWithLinks,
  LoginForm,
  PasswordRequestForm,
  QuestionCreationForm,
  QuestionEditForm,
  RegistrationForm,
  SessionCreationForm,
} from '.'

storiesOf('forms/components', module)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('LoginForm', () => <LoginForm intl={intlMock} />)
  .add('PasswordRequestForm', () => <PasswordRequestForm intl={intlMock} />)
  .add('RegistrationForm [NoTest]', () => <RegistrationForm intl={intlMock} />)
  // HACK: disable test for QuestionCreationForm as autosuggest breaks...
  .add('QuestionCreationForm [NoTest]', () => <QuestionCreationForm intl={intlMock} />)
  .add('QuestionEditForm [NoTest]', () => (
    <QuestionEditForm
      description={
        'Dies ist die lange Ausführung der Frage. Annahme du bist klein, wie möchtest du das mit deiner Grösse schaffen?'
      }
      intl={intlMock}
      options={{
        choices: [
          { correct: false, name: 'Hello' },
          { correct: true, name: 'You are small' },
          { correct: false, name: 'You are big' },
        ],
        randomized: false,
        restrictions: {
          type: 'NONE',
        },
      }}
      tags={['Hallo Tag', 'CAPM', 'Internet']}
      title={'Was ist das denn für eine Frage?'}
      type={'SC'}
      versions={[1, 2, 3, 4, 5]}
    />
  ))
  .add('SessionCreationForm [NoTest]', () => (
    <SessionCreationForm handleSubmit={() => null} intl={intlMock} />
  ))
storiesOf('forms/helpers', module).add('FormWithLinks', () => (
  <FormWithLinks
    button={{
      invalid: false,
      label: 'button',
      onSubmit: (e) => {
        e.preventDefault()
        action('submit')
      },
    }}
    links={[
      { href: 'href1', label: 'link1' },
      { href: 'href2', label: 'link2' },
      { href: 'href3', label: 'link3' },
    ]}
  >
    form fields
  </FormWithLinks>
))
