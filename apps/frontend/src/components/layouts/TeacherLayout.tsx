import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { FormattedMessage } from 'react-intl'
import clsx from 'clsx'

import CommonLayout from './CommonLayout'
import Navbar from '../common/navbar/Navbar'
import Sidebar from '../common/sidebar/Sidebar'
import SidebarItem from '../common/sidebar/SidebarItem'

interface Props {
  children: React.ReactNode | any
  fixedHeight?: boolean
  navbar?: any
  pageTitle?: string
  sidebar: any
}

const defaultProps = {
  fixedHeight: false,
  navbar: undefined,
  pageTitle: 'TeacherLayout',
}

function TeacherLayout({ children, fixedHeight, navbar, pageTitle, sidebar }: Props): React.ReactElement {
  const router = useRouter()

  const [isSidebarVisible, setIsSidebarVisible] = useState(false)

  const handleSidebarItemClick =
    (href: string): any =>
    (): Promise<boolean> =>
      router.push(href)

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
      disabled: router.pathname === '/questions',
      className: 'createSession',
      href: '/questions?creationMode=true',
      label: <FormattedMessage defaultMessage="Create Session" id="createSession.title" />,
      name: 'createSession',
    },
    // {
    //   href: '/user/admin',
    //   label: <FormattedMessage defaultMessage="Admin Area" id="admin.title" />,
    //   name: 'admin',
    // },
  ]

  return (
    <CommonLayout baseFontSize="14px" nextHeight="100%" pageTitle={pageTitle}>
      <div className={clsx('flex flex-col', fixedHeight ? 'h-screen min-h-[initial]' : 'h-[initial] min-h-screen')}>
        {navbar && (
          <div className="flex-initial print:hidden">
            <Navbar
              handleSidebarToggle={(): void => setIsSidebarVisible((prevState): boolean => !prevState)}
              sidebarVisible={isSidebarVisible}
              title={sidebarItems.find((item) => item.name === sidebar.activeItem)?.label}
              {...navbar}
            />
          </div>
        )}

        <div className="flex flex-1 overflow-hidden bg-white">
          <Sidebar
            handleSidebarItemClick={handleSidebarItemClick}
            items={sidebarItems.map(
              ({ name, className, href, label, disabled }): React.ReactElement => (
                <SidebarItem
                  active={name === sidebar.activeItem}
                  className={className}
                  disabled={disabled}
                  handleSidebarItemClick={handleSidebarItemClick(href)}
                  key={name}
                  name={name}
                >
                  {label}
                </SidebarItem>
              )
            )}
            visible={isSidebarVisible}
            {...sidebar}
          >
            {typeof children === 'function' ? children() : children}
          </Sidebar>
        </div>
      </div>
    </CommonLayout>
  )
}

TeacherLayout.defaultProps = defaultProps

export default TeacherLayout
