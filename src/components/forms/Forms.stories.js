/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { storiesOf } from '@storybook/react'
import { createStore, combineReducers } from 'redux'
import { reducer as formReducer } from 'redux-form'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import LoginForm from './LoginForm'
import PasswordResetForm from './PasswordResetForm'
import RegistrationForm from './RegistrationForm'
import QuestionCreationForm from './QuestionCreationForm'
import SessionCreationForm from './SessionCreationForm'
import { intlMock } from '../../../.storybook/utils'

const rootReducer = combineReducers({
  form: formReducer,
})

const store = createStore(rootReducer)

storiesOf('Forms', module)
  .addDecorator(getStory => <ReduxProvider store={store}>{getStory()}</ReduxProvider>)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('LoginForm', () => <LoginForm intl={intlMock} />)
  .add('PasswortResetForm', () => <PasswordResetForm intl={intlMock} />)
  .add('RegistrationForm', () => <RegistrationForm intl={intlMock} />)
  .add('QuestionCreationForm', () => <QuestionCreationForm intl={intlMock} />)
  .add('SessionCreationForm', () => (
    <SessionCreationForm intl={intlMock} handleSubmit={() => null} />
  ))
