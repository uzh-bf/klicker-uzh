/* eslint-disable react/jsx-sort-props */

import React from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'

import { SEMANTIC_VERSION } from '../../constants'
import { createLinks } from '../../lib'

const propTypes = {
  baseFontSize: PropTypes.string,
  children: PropTypes.element.isRequired,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  baseFontSize: '14px',
  pageTitle: 'CommonLayout',
}

const links = [
  'https://fonts.googleapis.com/css?family=Open Sans',
  `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SEMANTIC_VERSION}/semantic.min.css`,
]

const CommonLayout = ({ baseFontSize, children, pageTitle }) => (
  <div className="commonLayout">
    <Helmet defer={false}>
      {createLinks(links)}
      <title>{pageTitle}</title>
    </Helmet>

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

      input,
      textarea,
      .noBorder {
        border-radius: 0 !important;
      }

      .noBorder {
        border: 0 !important;
        box-shadow: none !important;
      }
    `}</style>
  </div>
)

CommonLayout.propTypes = propTypes
CommonLayout.defaultProps = defaultProps

export default CommonLayout
