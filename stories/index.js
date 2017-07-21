/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */

import React from 'react'
import { storiesOf } from '@storybook/react'

import Question from '../src/components/questions/Question'
import '../node_modules/semantic-ui-css/semantic.min.css'

storiesOf('Question', module)
  .add('SC with a single version', () =>
    (<Question id="1"
               lastUsed={['2015-02-08 14:32:11', '2016-09-09 15:22:09']}
               tagList={['CAPM', 'Risk']}
               title="Hello world" type="SC"
    />))
  .add('MC with multiple versions', () =>
    (<Question id="1" lastUsed={['2017-08-08 14:30:22', '2016-09-09 15:22:09']} tagList={['Beta']} title="Good question"
               type="MC" version="2"
    />),
  )
