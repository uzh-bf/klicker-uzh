import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { FormattedMessage } from 'react-intl'

import CommonLayout from './CommonLayout'
import Navbar from '../common/navbar/Navbar'
import Sidebar from '../common/sidebar/Sidebar'

interface Props {
  actionArea?: React.ReactElement
  children: React.ReactNode | any
  fixedHeight?: boolean
  navbar?: any
  pageTitle?: string
  sidebar: any
}

const defaultProps = {
  actionArea: undefined,
  fixedHeight: false,
  navbar: undefined,
  pageTitle: 'TeacherLayout',
}

function TeacherLayout({ actionArea, children, fixedHeight, navbar, pageTitle, sidebar }: Props): React.ReactElement {
  const router = useRouter()

  const [isSidebarVisible, setIsSidebarVisible] = useState(false)

  const handleSidebarItemClick = (href: string): any => (): Promise<boolean> => router.push(href)

  const sidebarItems = [
    {
      href: '/questions',
      label: <FormattedMessage defaultMessage="Question Pool" id="questionPool.title" />,
      name: 'questionPool',
    },
    {
      href: '/sessions',
      label: <FormattedMessage defaultMessage="Session List" id="sessionList.title" />,
      name: 'sessionList',
    },
    {
      href: '/sessions/running',
      label: <FormattedMessage defaultMessage="Running Session" id="runningSession.title" />,
      name: 'runningSession',
    },
    {
      className: 'createSession',
      href: '/questions?creationMode=true',
      label: <FormattedMessage defaultMessage="Create Session" id="createSession.title" />,
      name: 'createSession',
    },
    {
      href: '/user/admin',
      label: <FormattedMessage defaultMessage="Admin Area" id="admin.title" />,
      name: 'admin',
    },
  ]

  return (
    <CommonLayout baseFontSize="14px" nextHeight="100%" pageTitle={pageTitle}>
      <div className="teacherLayout">
        {navbar && (
          <div className="navbar">
            <Navbar
              handleSidebarToggle={(): void => setIsSidebarVisible((prevState): boolean => !prevState)}
              sidebarVisible={isSidebarVisible}
              title={sidebarItems.find((item) => item.name === sidebar.activeItem)?.label}
              {...navbar}
            />
          </div>
        )}

        <div className="content">
          <Sidebar
            handleSidebarItemClick={handleSidebarItemClick}
            items={sidebarItems}
            visible={isSidebarVisible}
            {...sidebar}
          >
            {typeof children === 'function' ? children() : children}
          </Sidebar>
        </div>

        <div className="actionArea">{actionArea}</div>

        <style jsx>{`
          .teacherLayout {
            display: flex;
            flex-direction: column;
            height: ${fixedHeight ? '100vh' : 'initial'};
            min-height: ${fixedHeight ? 'initial' : '100vh'};

            .navbar {
              flex: 0 0 auto;
            }

            .content {
              background-color: white;

              flex: 1;

              display: flex;

              overflow: hidden;
            }

            .actionArea {
              flex: 0 0 auto;
            }
          }
        `}</style>
      </div>
    </CommonLayout>
  )
}

TeacherLayout.defaultProps = defaultProps

export default TeacherLayout
