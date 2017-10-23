/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import { combineReducers, createStore } from 'redux'
import { reducer as formReducer } from 'redux-form'

import { intlMock } from '../../../.storybook/utils'

import {
  FormWithLinks,
  LoginForm,
  PasswordResetForm,
  QuestionCreationForm,
  QuestionEditForm,
  RegistrationForm,
  SemanticInput,
  SessionCreationForm,
} from '.'

const rootReducer = combineReducers({
  form: formReducer,
})

const store = createStore(rootReducer)

storiesOf('forms/components', module)
  .addDecorator(getStory => <ReduxProvider store={store}>{getStory()}</ReduxProvider>)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('LoginForm', () => <LoginForm intl={intlMock} />)
  .add('PasswortResetForm', () => <PasswordResetForm intl={intlMock} />)
  .add('RegistrationForm', () => <RegistrationForm intl={intlMock} />)
  // HACK: disable test for QuestionCreationForm as autosuggest breaks...
  .add('QuestionCreationForm [NoTest]', () => <QuestionCreationForm intl={intlMock} />)
  .add('QuestionEditForm', () => (
    <QuestionEditForm
      intl={intlMock}
      options={{
        choices: ['Hello', 'You are small', 'You are big'],
        randomized: false,
        restrictions: {
          type: 'NONE',
        },
      }}
      title={'Was ist das denn für eine Frage?'}
      // tags={['Hallo Tag', 'CAPM', 'Internet']}
      type={'SC'}
      versions={[1, 2, 3, 4, 5]}
    />
  ))
  .add('SessionCreationForm', () => (
    <SessionCreationForm intl={intlMock} handleSubmit={() => null} />
  ))
storiesOf('forms/helpers', module)
  .addDecorator(getStory => <ReduxProvider store={store}>{getStory()}</ReduxProvider>)
  .add('FormWithLinks', () => (
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
  .add('SemanticInput', () => <SemanticInput label="label" meta={{}} input={{}} />)
  .add('SemanticInput (with error)', () => (
    <SemanticInput
      label="label"
      meta={{ error: 'fail', invalid: true, touched: true }}
      input={{}}
    />
  ))
