/* eslint-disable import/no-extraneous-dependencies, react/prop-types */
import React from 'react'
import { storiesOf } from '@storybook/react'

import StaticLayout from './StaticLayout'
import TeacherLayout from './TeacherLayout'
import StudentLayout from './StudentLayout'
import EvaluationLayout from './EvaluationLayout'
import { intlMock } from '../../../.storybook/utils'

storiesOf('layouts', module)
  .add('StaticLayout', () => <StaticLayout>some static content</StaticLayout>)
  .add('StudentLayout', () => (
    <StudentLayout sidebar={{ visible: true }} title="title">
      some student content
    </StudentLayout>
  ))
  .add('TeacherLayout', () => (
    <TeacherLayout sidebar={{ visible: true }} title="title">
      some teacher content
    </TeacherLayout>
  ))
  .add('EvaluationLayout', () => <EvaluationLayout intl={intlMock} />)
