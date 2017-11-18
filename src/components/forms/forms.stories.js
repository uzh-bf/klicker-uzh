/* eslint-disable import/no-extraneous-dependencies, react/prop-types */

import React from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { DragDropContextProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'

import { configureStore, intlMock } from '../../../.storybook/utils'

import {
  LoginForm,
  PasswordResetForm,
  RegistrationForm,
  QuestionCreationForm,
  SessionCreationForm,
  FormWithLinks,
  SemanticInput,
} from '.'

let store
const getStoryWithRedux = (getStory) => {
  // initialize the redux store
  if (!store) {
    store = configureStore()
  }

  return <ReduxProvider store={store}>{getStory()}</ReduxProvider>
}

storiesOf('forms/components', module)
  .addDecorator(getStoryWithRedux)
  .addDecorator(getStory => (
    <DragDropContextProvider backend={HTML5Backend}>{getStory()}</DragDropContextProvider>
  ))
  .add('LoginForm', () => <LoginForm intl={intlMock} />)
  .add('PasswortResetForm', () => <PasswordResetForm intl={intlMock} />)
  .add('RegistrationForm [NoTest]', () => <RegistrationForm intl={intlMock} />)
  // HACK: disable test for QuestionCreationForm as autosuggest breaks...
  .add('QuestionCreationForm [NoTest]', () => <QuestionCreationForm intl={intlMock} />)
  .add('SessionCreationForm', () => (
    <SessionCreationForm handleSubmit={() => null} intl={intlMock} />
  ))

storiesOf('forms/helpers', module)
  .addDecorator(getStoryWithRedux)
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
  .add('SemanticInput', () => <SemanticInput input={{}} label="label" meta={{}} />)
  .add('SemanticInput (with error)', () => (
    <SemanticInput
      input={{}}
      label="label"
      meta={{ error: 'fail', invalid: true, touched: true }}
    />
  ))
