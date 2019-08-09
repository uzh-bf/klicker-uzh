/* eslint-disable */
import React, { useState } from 'react'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { FormattedMessage } from 'react-intl'
import { useRouter } from 'next/router'
import { useQuery } from '@apollo/react-hooks'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'
import { Button, Checkbox } from 'semantic-ui-react'

import { CHART_DEFAULTS, QUESTION_TYPES } from '../../constants'
import { toValueArray } from '../../lib'
import { Chart, Possibilities, VisualizationType } from '../../components/evaluation'
import SessionEvaluationPublicQuery from '../../graphql/queries/SessionEvaluationPublicQuery.graphql'
import SessionEvaluationQuery from '../../graphql/queries/SessionEvaluationQuery.graphql'
import CommonLayout from '../../components/layouts/CommonLayout'
import { extractInstancesFromSession } from './evaluation'
import useLogging from '../../lib/useLogging'
import LoadSessionData from '../../components/sessions/LoadSessionData'

function Print(): React.ReactElement<any> {
  useLogging()

  const router = useRouter()

  const isPublic = !!router.query.public
  const sessionId: string = router.query.sessionId.toString()

  const [activeVisualizations, setActiveVisualizations] = useState(CHART_DEFAULTS)
  const [showSolution, setShowSolution] = useState(false)

  return (
    <LoadSessionData sessionId={sessionId} isPublic={isPublic}>
      {({ data, loading }) => {
        if (loading || !data) {
          return null
        }

        const { activeInstances, sessionStatus } = extractInstancesFromSession(data)

        return (
          <CommonLayout baseFontSize="20">
            <div className="noPrint">
              <Button primary content="Print" icon="print" onClick={() => window.print()} />
              <Checkbox
                toggle
                checked={showSolution}
                label="Show Solution"
                onChange={() => setShowSolution(prev => !prev)}
              />
            </div>

            {activeInstances.map(activeInstance => {
              if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
                // convert the result data into an array with primitive numbers
                const valueArray = toValueArray(activeInstance.results.data)
                const hasResults = valueArray.length > 0

                activeInstance.statistics = {
                  bins: null,
                  max: hasResults && max(valueArray),
                  mean: hasResults && mean(valueArray),
                  median: hasResults && median(valueArray),
                  min: hasResults && min(valueArray),
                  onChangeBins: () => null,
                  q1: hasResults && quantileSeq(valueArray, 0.25),
                  q3: hasResults && quantileSeq(valueArray, 0.75),
                  sd: hasResults && std(valueArray),
                }
              } else {
                activeInstance.results = {
                  ...activeInstance.results,
                  data:
                    _get(activeInstance, 'results.data') &&
                    activeInstance.results.data.map(({ correct, count, value }) => ({
                      correct,
                      count,
                      percentage: _round(100 * (count / _get(activeInstance, 'results.totalResponses')), 1),
                      value,
                    })),
                  totalResponses: _get(activeInstance, 'results.totalResponses'),
                }
              }

              const { results, question, version, statistics } = activeInstance
              const { description, options } = question.versions[version]
              const activeVisualization = activeVisualizations[question.type]

              return (
                <>
                  <div className="description">{description}</div>
                  <div className="flexContainer">
                    <div className="chart">
                      <Chart
                        activeVisualization={activeVisualization}
                        data={results.data}
                        instanceId={activeInstance.id}
                        isPublic={false}
                        numBins={null}
                        handleShowGraph={null}
                        questionType={question.type}
                        restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
                        sessionId={sessionId}
                        sessionStatus={sessionStatus}
                        showGraph={true}
                        showSolution={showSolution}
                        statistics={statistics}
                        totalResponses={results.totalResponses}
                      />
                    </div>
                    <div className="possibilities">
                      <Possibilities
                        data={results.data}
                        questionOptions={options}
                        questionType={question.type}
                        showGraph={true}
                        showSolution={showSolution}
                      />
                      <div className="totalResponses">
                        <FormattedMessage
                          id="evaluation.totalParticipants.label"
                          defaultMessage="Total participants:"
                        />{' '}
                        {results.totalResponses}
                      </div>
                      <div className="visualizationType noPrint">
                        <VisualizationType
                          activeVisualization={activeVisualization}
                          questionType={question.type}
                          onChangeType={(type, newVisualization) =>
                            setActiveVisualizations(currentState => ({ ...currentState, [type]: newVisualization }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )
            })}
            <style jsx global>{`
              html {
                font-size: 1.5em;
              }
            `}</style>

            <style jsx>{`
              @import 'src/theme';

              @page {
                size: landscape;
              }

              .description {
                background-color: $color-primary-background;
                border-top: 2px solid $color-primary;
                border-bottom: 2px solid $color-primary;
                font-weight: bold;
                font-size: 1.2em;
                padding: 1em;
                text-align: left;
              }

              .flexContainer {
                display: flex;
                flex-flow: row nowrap;
                page-break-after: always;
                height: 100%;
              }

              .possibilities {
                flex: 0 0 30%;
                padding: 1em;
              }

              .chart {
                padding: 1rem;
                flex: 1;
                height: 30em;
              }

              .totalResponses {
                padding: 1rem;
                padding-left: 0;
              }

              .noPrint {
                @media print {
                  display: none;
                }

                :global(button) {
                  margin: 1rem;
                }
              }
            `}</style>
          </CommonLayout>
        )
      }}
    </LoadSessionData>
  )
}

export default Print
