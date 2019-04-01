import React /* , { useState, useEffect } */ from 'react'
// import PropTypes from 'prop-types'
// import { Document, Page } from 'react-pdf'
import { Button } from 'semantic-ui-react'

const propTypes = {}

const defaultProps = {}

const PdfExport = () => {
  /* const [csvData, setCsvData] = useState()

  /*useEffect(() => {
    
  }, [activeInstances]) */

  return (
    <div>
      <Button primary content="Export PDF" />
    </div>
  )
}

PdfExport.propTypes = propTypes
PdfExport.defaultProps = defaultProps

export default PdfExport
