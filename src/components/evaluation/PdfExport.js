import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'semantic-ui-react'
import ReactDOM from 'react-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { printIntrospectionSchema } from 'graphql/utilities'
import Chart from './Chart'

const propTypes = {}

const defaultProps = {}

const PdfExport = ({ sessionId }) => {
  return (
    <div>
      <a href={'/sessions/pdf/' + sessionId}>
        <Button primary content="Export PDF" />
      </a>
    </div>
  )
}

PdfExport.propTypes = propTypes
PdfExport.defaultProps = defaultProps

export default PdfExport
