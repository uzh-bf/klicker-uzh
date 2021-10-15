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
      <div className="">
        <main className="m-auto md:w-2/3">{children}</main>

        <footer>
          <hr className="m-0" />
          <p className="p-5 text-xs text-center text-gray-400 bg-gray-100 border-gray-30">
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
