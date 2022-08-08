import { faTable } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'
import { CSVLink } from 'react-csv'

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
      <Button className="px-3 py-1 mr-1">
        <Button.Icon>
          <FontAwesomeIcon icon={faTable} />
        </Button.Icon>
        <Button.Label>Export CSV</Button.Label>
      </Button>
    </CSVLink>
  )
}

export default CsvExport
