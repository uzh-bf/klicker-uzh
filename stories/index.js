/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */

import React from 'react'
import { storiesOf } from '@storybook/react'

import Question from '../src/components/questions/Question'
import '../node_modules/semantic-ui-css/semantic.min.css'

storiesOf('Question', module)
  .add('SC with a single version', () => <Question id="1" tagList={['CAPM', 'Risk']} title="Hello world" type="SC" />)
  .add('MC with multiple versions', () =>
    <Question id="1" tagList={['Beta']} title="Good question" type="MC" version="2" />,
  )
