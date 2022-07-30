import React, { useState, useEffect } from 'react'
import { CSVLink } from 'react-csv'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTable } from '@fortawesome/free-solid-svg-icons'

interface Props {
  activeInstances: any[]
  sessionId: string
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
    <CSVLink data={csvData} filename={`klicker-results-${sessionId}.csv`}>
      <Button className="mr-1 py-1 px-3">
        <FontAwesomeIcon icon={faTable} />
        <div>Export CSV</div>
      </Button>
    </CSVLink>
  )
}

export default CsvExport
