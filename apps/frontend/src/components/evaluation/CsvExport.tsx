import React, { useState, useEffect } from 'react'
import { CSVLink } from 'react-csv'
import { Button } from 'semantic-ui-react'

interface Props {
  activeInstances: any[]
  sessionId: string
}

const defaultProps = {
  activeInstances: [],
}

function CsvExport({ activeInstances, sessionId }: Props): React.ReactElement {
  const [csvData, setCsvData] = useState([])

  useEffect((): void => {
    const result = []
    activeInstances.forEach((e1): void => {
      const counts = ['']
      const answers = [e1.question.versions[0].description]
      e1.results.data.forEach((e2): void => {
        answers.push(e2.value)
        counts.push(e2.count)
      })
      result.push(answers)
      result.push(counts)
    })
    setCsvData(result)
  }, [activeInstances.length, sessionId])

  return (
    <div className="csvExport">
      <CSVLink data={csvData} filename={`klicker-results-${sessionId}.csv`}>
        <Button content="Export CSV" icon="table" />
      </CSVLink>
    </div>
  )
}

CsvExport.defaultProps = defaultProps

export default CsvExport
