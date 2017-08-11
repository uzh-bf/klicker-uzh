// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { boolean, number } from '@storybook/addon-knobs'

import QuestionBlock from './QuestionBlock'
import fixtures from '../../../.storybook/fixtures'

storiesOf('QuestionBlock', module)
  .add('default', () =>
    (<QuestionBlock
      {...fixtures.questionBlock}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )
  .add('empty', () =>
    (<QuestionBlock
      {...fixtures.questionBlock}
      questions={[]}
      showSolutions={boolean('showSolutions', false)}
      timeLimit={number('timeLimit', 60)}
    />),
  )
