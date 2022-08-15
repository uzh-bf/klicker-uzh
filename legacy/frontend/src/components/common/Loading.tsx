import React from 'react'
import { useIntl } from 'react-intl'
import { Loader } from 'semantic-ui-react'

import TeacherLayout from '../layouts/TeacherLayout'

function LoadingDiv(): React.ReactElement {
  return (
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
}

interface LoadingTeacherLayoutProps {
  pageId: string
  title: string
  children: React.ReactChildren
}

function LoadingTeacherLayout({ pageId, title, children }: LoadingTeacherLayoutProps): React.ReactElement {
  const intl = useIntl()

  const navbarConfig = {
    title: intl.formatMessage({
      defaultMessage: title,
      id: `${pageId}.title`,
    }),
  }

  return (
    <TeacherLayout
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

export { LoadingDiv, LoadingTeacherLayout }
