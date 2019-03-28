import React from 'react'
import PropTypes from 'prop-types'
import { CSVLink } from 'react-csv'
import { Button } from 'semantic-ui-react'

const propTypes = {
  data: PropTypes.any,
}

const defaultProps = {
  data: undefined,
}

const csvData = [['a', 'b', 'c']]

const CsvExport = () => (
  <div className="csv-export">
    <CSVLink data={csvData} filename={`csv-export.csv`}>
      <Button
        // show csv-download button at the end off a session
        color="blue"
        content="Download CSV"
      />
    </CSVLink>
  </div>
)

CsvExport.propTypes = propTypes
CsvExport.defaultProps = defaultProps

export default CsvExport
