import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { CSVLink } from 'react-csv'
import { Button } from 'semantic-ui-react'

const propTypes = {
  activeInstances: PropTypes.array,
  sessionId: PropTypes.string,
}

const defaultProps = {
  activeInstances: [],
}

const CsvExport = ({ activeInstances, sessionId }) => {
  const [csvData, setCsvData] = useState()

  useEffect(() => {
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
    <div>
      <CSVLink data={csvData || []} filename={`csv-export-${sessionId}.csv`}>
        <Button primary content="Export CSV" />
      </CSVLink>
    </div>
  )
}

CsvExport.propTypes = propTypes
CsvExport.defaultProps = defaultProps

export default CsvExport
