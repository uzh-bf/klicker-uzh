/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'

import ListWithHeader from './ListWithHeader'

storiesOf('ListWithHeader', module).add('ListWithHeader', () => (
  <ListWithHeader items={['abcd', 'cdef']}>hello world</ListWithHeader>
))
