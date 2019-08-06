import React from 'react'
import PropTypes from 'prop-types'
import { Loader } from 'semantic-ui-react'
import { useIntl } from 'react-intl'

import TeacherLayout from '../layouts/TeacherLayout'

const LoadingDiv = () => (
  <div className="loading">
    <Loader active />

    <style jsx>
      {`
        .loading {
          display: flex;
          height: 100%;
          width: 100%;

          > :global(*) {
            flex: 1;
          }
        }
      `}
    </style>
  </div>
)

const LoadingTeacherLayout = ({ pageId, title, children }) => {
  const intl = useIntl()
  const navbarConfig = {
    title: intl.formatMessage({
      defaultMessage: title,
      id: `${pageId}.title`,
    }),
  }

  return (
    <TeacherLayout
      intl={intl}
      navbar={navbarConfig}
      pageTitle={intl.formatMessage({
        defaultMessage: title,
        id: `${pageId}.pageTitle`,
      })}
      sidebar={{ activeItem: pageId }}
    >
      {children}
    </TeacherLayout>
  )
}
LoadingTeacherLayout.propTypes = {
  children: PropTypes.element.isRequired,
  pageId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}

export { LoadingDiv, LoadingTeacherLayout }
