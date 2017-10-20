import React from 'react'
import PropTypes from 'prop-types'

import { CommonLayout } from '.'

const propTypes = {
  children: PropTypes.node.isRequired,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  pageTitle: 'StaticLayout',
}

const StaticLayout = ({ children, pageTitle }) => (
  <CommonLayout baseFontSize="16px" pageTitle={pageTitle}>
    <div className="staticLayout">
      <main className="content">{children}</main>

      <footer>&copy; IBF</footer>

      <style jsx>{`
        .staticLayout {
          display: flex;
          flex-direction: column;
          min-height: 100vh;

          footer {
            background-color: lightgrey;
            border-top: 2px solid orange;
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  </CommonLayout>
)

StaticLayout.propTypes = propTypes
StaticLayout.defaultProps = defaultProps

export default StaticLayout
