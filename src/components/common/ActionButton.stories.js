/* eslint-disable import/no-extraneous-dependencies */

import React from 'react'
import { storiesOf } from '@storybook/react'
import { action } from '@storybook/addon-actions'

import ActionButton from './ActionButton'

storiesOf('ActionButton', module).add('ActionButton', () => (
  <ActionButton
    items={[
      { handleClick: () => action('click abcd'), label: 'abcd' },
      { handleClick: () => action('click cdef'), label: 'cdef' },
    ]}
  />
))
