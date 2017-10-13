/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import { combineReducers, createStore } from 'redux'
import { reducer as formReducer } from 'redux-form'

import { intlMock } from '../../../.storybook/utils'

import LoginForm from './LoginForm'
import PasswordResetForm from './PasswordResetForm'
import RegistrationForm from './RegistrationForm'
import QuestionCreationForm from './QuestionCreationForm'
import SessionCreationForm from './SessionCreationForm'

import FormWithLinks from './components/FormWithLinks'
import SemanticInput from './components/SemanticInput'

const rootReducer = combineReducers({
  form: formReducer,
})

const store = createStore(rootReducer)

storiesOf('forms/components', module)
  .addDecorator(getStory => <ReduxProvider store={store}>{getStory()}</ReduxProvider>)
  .add('LoginForm', () => <LoginForm intl={intlMock} />)
  .add('PasswortResetForm', () => <PasswordResetForm intl={intlMock} />)
  .add('RegistrationForm', () => <RegistrationForm intl={intlMock} />)
  // HACK: disable test for QuestionCreationForm as autosuggest breaks...
  .add('QuestionCreationForm [NoTest]', () => <QuestionCreationForm intl={intlMock} />)
  .add('SessionCreationForm', () => (
    <SessionCreationForm intl={intlMock} handleSubmit={() => null} />
  ))

storiesOf('forms/helpers', module)
  .addDecorator(getStory => <ReduxProvider store={store}>{getStory()}</ReduxProvider>)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
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
