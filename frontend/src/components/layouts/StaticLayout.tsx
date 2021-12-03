import React from 'react'

import CommonLayout from './CommonLayout'

interface Props {
  children: React.ReactNode
  pageTitle?: string
}

const defaultProps = {
  pageTitle: 'StaticLayout',
}

function StaticLayout({ children, pageTitle }: Props): React.ReactElement {
  return (
    <CommonLayout baseFontSize="16px" nextHeight="100%" pageTitle={pageTitle}>
      <div className="flex flex-col h-full">
        <main className="md:m-auto content">{children}</main>

        <footer>
          <hr className="p-0 m-0 h-[1px] border-0 bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
          <p className="p-5 m-0 text-xs leading-5 text-center text-gray-400 bg-gray-50">
            &copy;
            {new Date().getFullYear()} IBF Teaching Center, Department of Banking and Finance, University of Zurich. All
            rights reserved.
            <br />
            Products and Services displayed herein are trademarks or registered trademarks of their respective owners.
          </p>
        </footer>
      </div>
    </CommonLayout>
  )
}

StaticLayout.defaultProps = defaultProps

export default StaticLayout
