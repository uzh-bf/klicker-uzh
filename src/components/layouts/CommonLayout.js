/* eslint-disable react/jsx-sort-props */

import React from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'

import '../../lib/semantic/dist/semantic.css'

const propTypes = {
  baseFontSize: PropTypes.string,
  children: PropTypes.element.isRequired,
  nextHeight: PropTypes.string,
  nextMinHeight: PropTypes.string,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  baseFontSize: '14px',
  nextHeight: 'auto',
  nextMinHeight: 0,
  pageTitle: 'CommonLayout',
}

const CommonLayout = ({
  baseFontSize,
  children,
  nextHeight,
  nextMinHeight,
  pageTitle,
}) => (
  <div className="commonLayout">
    <Head>
      <title>
        {pageTitle}
      </title>
    </Head>

    {children}

    <style jsx global>
      {`
        @import 'src/theme';

        html {
          font-size: ${baseFontSize} !important;
        }

        body {
          font-size: 1rem !important;
        }

        h1 {
          font-size: $font-size-h1 !important;
        }

        h2 {
          font-size: $font-size-h2 !important;
        }

        h3 {
          font-size: $font-size-h3 !important;
        }

        #__next {
          height: ${nextHeight};
          min-height: ${nextMinHeight};
        }

        .noBorder {
          border-radius: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        /* FIXME: workarounds for modal placement */
        .ui.dimmer {
          display: flex !important;
        }
        .ui.modal {
          margin-top: 0;
        }
      `}
    </style>
    <style jsx>
      {`
        .commonLayout {
          height: 100%;
        }
      `}
    </style>
  </div>
)

CommonLayout.propTypes = propTypes
CommonLayout.defaultProps = defaultProps

export default CommonLayout
