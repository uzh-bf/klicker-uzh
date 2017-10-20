import React from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import { compose, lifecycle } from 'recompose'

import { SemanticVersion } from '../../constants'
import { createLinks, initLogging } from '../../lib'

const propTypes = {
  baseFontSize: PropTypes.string,
  children: PropTypes.element.isRequired,
  pageTitle: PropTypes.string,
}

const defaultProps = {
  baseFontSize: '14px',
  pageTitle: 'CommonLayout',
}

const CommonLayout = ({ baseFontSize, children, pageTitle }) => (
  <div className="commonLayout">
    <Helmet defer={false}>
      {createLinks([
        'https://fonts.googleapis.com/css?family=Open Sans',
        `https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/${SemanticVersion}/semantic.min.css`,
      ])}
      <title>{pageTitle}</title>
    </Helmet>

    {children}

    <style jsx global>{`
      * {
        font-family: 'Open Sans', sans-serif !important;
      }

      html {
        font-size: ${baseFontSize} !important;
      }

      body {
        font-size: 1rem !important;
      }

      input,
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

export default compose(
  lifecycle({
    componentWillMount: () => {
      // initialize sentry and logrocket (if appropriately configured)
      initLogging()
    },
  }),
)(CommonLayout)
