// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import * as React from 'react'
import { storiesOf } from '@storybook/react'

import QuestionSingle from './QuestionSingle'
import fixtures from '../../../.storybook/fixtures'

storiesOf('QuestionSingle', module).add('default', () => <QuestionSingle {...fixtures.question} />)
