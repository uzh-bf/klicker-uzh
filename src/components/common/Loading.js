import React from 'react'

import TeacherLayout from '../layouts/TeacherLayout'

export const LoadingDiv = () => <div className="ui indeterminate text loader">Loading</div>

export const LoadingTeacherLayout = ({ intl, pageId, title }) => {
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
