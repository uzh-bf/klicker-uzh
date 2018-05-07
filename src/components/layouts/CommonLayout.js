/* eslint-disable react/jsx-sort-props */

import React from 'react'
import PropTypes from 'prop-types'
import Head from 'next/head'

// import { SEMANTIC_VERSION } from '../../constants'
// import { createLinks } from '../../lib'

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
  baseFontSize, children, nextHeight, nextMinHeight, pageTitle,
}) => (
  <div className="commonLayout">
    <Head>
      {/* createLinks([
        'https://fonts.googleapis.com/css?family=Open Sans',
        `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SEMANTIC_VERSION}/semantic.min.css`,
      ]) */}
      <title>{pageTitle}</title>
    </Head>

    {children}

    <style jsx global>{`
      *:not(i) {
        font-family: 'Open Sans', sans-serif !important;
      }

      html {
        font-size: ${baseFontSize} !important;
      }

      body {
        font-size: 1rem !important;
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
    `}</style>
    <style jsx>{`
      .commonLayout {
        height: 100%;
      }
    `}</style>
  </div>
)

CommonLayout.propTypes = propTypes
CommonLayout.defaultProps = defaultProps

export default CommonLayout
