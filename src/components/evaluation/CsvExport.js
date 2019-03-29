import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { CSVLink } from 'react-csv'
import { Button } from 'semantic-ui-react'

const propTypes = {
  activeInstances: PropTypes.any,
}

const defaultProps = {
  activeInstances: undefined,
}

const CsvExport = ({ activeInstances }) => {
  const [csvData, setCsvData] = useState()

  useEffect(() => {
    console.log(activeInstances)
    const result = []
    activeInstances.forEach(e1 => {
      const counts = ['']
      const answers = [e1.question.versions[0].description]
      e1.results.data.forEach(e2 => {
        answers.push(e2.value)
        counts.push(e2.count)
      })
      result.push(answers)
      result.push(counts)
    })
    setCsvData(result)
  }, [activeInstances])

  return (
    <div className="csv-export">
      <CSVLink data={csvData || []} filename={`csv-export.csv`}>
        <Button color="blue" content="Export CSV" />
      </CSVLink>
    </div>
  )
}

CsvExport.propTypes = propTypes
CsvExport.defaultProps = defaultProps

export default CsvExport
