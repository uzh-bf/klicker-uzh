import { defineMessages } from 'react-intl'

export default defineMessages({
  backToLogin: {
    defaultMessage: 'Back to login',
    id: 'form.passwordReset.backToLogin',
  },
  emailInvalid: {
    defaultMessage: 'Please provide a valid email address.',
    id: 'form.email.invalid',
  },
  emailLabel: {
    defaultMessage: 'Email',
    id: 'form.email.label',
  },
  emailNotAvailable: {
    defaultMessage: 'An account for this email address already exists. Please provide another address.',
    id: 'form.email.notAvailable',
  },
  forgotPassword: {
    defaultMessage: 'Forgot password?',
    id: 'form.forgotPassword.label',
  },
  institutionInvalid: {
    defaultMessage: 'Please provide a valid institution.',
    id: 'form.institution.invalid',
  },
  institutionLabel: {
    defaultMessage: 'Institution',
    id: 'form.institution.label',
  },
  passwordInvalid: {
    defaultMessage: 'Please provide a valid password (8+ characters).',
    id: 'form.password.invalid',
  },
  passwordLabel: {
    defaultMessage: 'Password',
    id: 'form.password.label',
  },
  passwordRepeatInvalid: {
    defaultMessage: 'Please ensure that passwords match.',
    id: 'form.passwordRepeat.invalid',
  },
  passwordRepeatLabel: {
    defaultMessage: 'Repeat password',
    id: 'form.passwordRepeat.label',
  },
  shortnameInvalid: {
    defaultMessage: 'Please provide a valid account ID (3-8 characters).',
    id: 'form.shortname.invalid',
  },
  shortnameLabel: {
    defaultMessage: 'Account ID / Join Link',
    id: 'form.shortname.label',
  },
  shortnameNotAvailable: {
    defaultMessage: 'This Account ID has already been taken. Please choose another one.',
    id: 'form.shortname.notAvailable',
  },
  shortnameTooltip: {
    defaultMessage:
      'A unique identifier for your account. Must be between 3 and 8 characters long (only alphanumeric and hyphen).',
    id: 'form.shortname.tooltip',
  },
  submit: {
    defaultMessage: 'Submit',
    id: 'form.common.button.submit',
  },
  useCaseLabel: {
    defaultMessage: 'Use case description',
    id: 'form.useCase.label',
  },
  useCaseTooltip: {
    defaultMessage: 'Short description of your planned use case for the Klicker UZH.',
    id: 'form.useCase.tooltip',
  },
  usernameLabel: {
    defaultMessage: 'Username',
    id: 'common.string.username',
  },
  usernameInvalid: {
    defaultMessage: 'Please provide a valid username.',
    id: 'form.username.invalid',
  },
})
