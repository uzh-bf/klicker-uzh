/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import React from 'react'
import { storiesOf } from '@storybook/react'
import Question from '../src/components/questions/Question'

storiesOf('Question', module).add('basic', () => <Question id="abcd" title="Hello world" />)
