/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import React from 'react'
import { storiesOf } from '@storybook/react'
import Question from '../src/components/questions/Question'
import Session from '../src/components/sessions/Session'

storiesOf('Question', module).add('basic', () => <Question id="abcd" title="Hello world" />)

storiesOf('Session', module).add('basic', () => <Session id="abcd" title="Hello world" />)
