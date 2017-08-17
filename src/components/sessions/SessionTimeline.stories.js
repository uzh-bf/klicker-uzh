// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import * as React from 'react';
import { storiesOf } from '@storybook/react'

import SessionTimeline from './SessionTimeline'
import { intlMock } from '../../../.storybook/utils'

storiesOf('SessionTimeline', module).add('default', () =>
  <SessionTimeline blocks={[]} intl={intlMock} />,
)
