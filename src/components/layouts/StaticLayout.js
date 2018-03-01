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
  <CommonLayout baseFontSize="16px" nextHeight="100%" pageTitle={pageTitle}>
    <div className="staticLayout">
      <main className="content">{children}</main>

      <footer>
        <hr />
        <p>
          &copy;2017 IBF Teaching Center, Department of Banking and Finance, University of Zurich.
          All rights reserved.<br />
          Products and Services displayed herein are trademarks or registered trademarks of their
          respective owners.
        </p>
      </footer>

      <style jsx>{`
        @import 'src/theme';

        .staticLayout {
          height: 100%;

          display: flex;
          flex-direction: column;

          @include desktop-tablet-only {
            .content {
              margin: auto;
            }
          }

          footer {
            hr {
              margin: 0;
              padding: 0;
              border: 0;
              height: 1px;
              background-image: linear-gradient(
                to right,
                transparent,
                rgba(0, 0, 0, 0.5),
                transparent
              );
            }

            p {
              font-size: 0.75rem;
              color: #999999;
              text-align: center;
              margin: 0;
              background-color: #f9f9f9;
              padding: 20px;
            }
          }
        }
      `}</style>
    </div>
  </CommonLayout>
)

StaticLayout.propTypes = propTypes
StaticLayout.defaultProps = defaultProps

export default StaticLayout
