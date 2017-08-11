// @flow

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
/* eslint-disable react/jsx-max-props-per-line, react/jsx-indent-props */
/* eslint-disable react/jsx-first-prop-new-line */
/* eslint-disable react/prop-types */

import React from 'react'
import { storiesOf } from '@storybook/react'

import ListWithHeader from './ListWithHeader'

storiesOf('ListWithHeader', module).add('default', () =>
  <ListWithHeader items={['abcd', 'cdef']}>hello world</ListWithHeader>,
)
