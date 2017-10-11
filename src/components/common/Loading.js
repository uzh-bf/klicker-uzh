import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'

import TeacherLayout from '../layouts/TeacherLayout'

const LoadingDiv = () => <div className="ui indeterminate text loader">Loading</div>

const LoadingTeacherLayout = ({ intl, pageId, title }) => {
  const navbarConfig = {
    title: intl.formatMessage({
      defaultMessage: title,
      id: `teacher.${pageId}.title`,
    }),
  }

  return (
    <TeacherLayout
      intl={intl}
      navbar={navbarConfig}
      pageTitle={intl.formatMessage({
        defaultMessage: title,
        id: `teacher.${pageId}.pageTitle`,
      })}
      sidebar={{ activeItem: pageId }}
    >
      Loading
    </TeacherLayout>
  )
}
LoadingTeacherLayout.propTypes = {
  intl: intlShape.isRequired,
  pageId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export { LoadingDiv, LoadingTeacherLayout }
