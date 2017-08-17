// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import * as React from 'react';
import { storiesOf } from '@storybook/react'

import Question from './Question'
import fixtures from '../../../.storybook/fixtures'

storiesOf('Question', module)
  .add('SC with a single version', () => <Question {...fixtures.question} />)
  .add('MC with multiple versions', () => <Question {...fixtures.question} type="MC" version={2} />)
  .add('MC without tags', () => <Question {...fixtures.question} tags={[]} type="MC" />)
