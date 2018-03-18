/* eslint-disable react/jsx-sort-props */

import React from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'

import { SEMANTIC_VERSION } from '../../constants'
import { createLinks } from '../../lib'

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

const links = [
  'https://fonts.googleapis.com/css?family=Open Sans',
  `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SEMANTIC_VERSION}/semantic.min.css`,
]

const CommonLayout = ({
  baseFontSize, children, nextHeight, nextMinHeight, pageTitle,
}) => (
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
