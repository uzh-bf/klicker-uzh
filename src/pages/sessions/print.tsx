/* eslint-disable */
import React, { useState } from 'react'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { FormattedMessage } from 'react-intl'
import { useRouter } from 'next/router'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'
import { Button, Checkbox } from 'semantic-ui-react'

import { CHART_DEFAULTS, QUESTION_TYPES } from '../../constants'
import { toValueArray } from '../../lib/utils/math'
import Chart from '../../components/evaluation/Chart'
import Possibilities from '../../components/evaluation/Possibilities'
import VisualizationType from '../../components/evaluation/VisualizationType'
import CommonLayout from '../../components/layouts/CommonLayout'
import { extractInstancesFromSession } from './evaluation'
import useLogging from '../../lib/hooks/useLogging'
import LoadSessionData from '../../components/sessions/LoadSessionData'
import { withApollo } from '../../lib/apollo'

function Print(): React.ReactElement<any> {
  useLogging()

  const router = useRouter()

  const isPublic = !!router.query.public
  const sessionId: string = router.query.sessionId.toString()

  const [activeVisualizations, setActiveVisualizations] = useState(CHART_DEFAULTS)
  const [showSolution, setShowSolution] = useState(false)

  return (
    <LoadSessionData sessionId={sessionId} isPublic={isPublic}>
      {({ session, loading, error }) => {
        if (loading || error || !_get(session, 'blocks')) {
          return null
        }

        const { activeInstances, sessionStatus } = extractInstancesFromSession(session)

        return (
          <CommonLayout baseFontSize="16">
            <div className="actions noPrint">
              <Button primary content="Print" icon="print" onClick={() => window.print()} />
              <Checkbox
                toggle
                checked={showSolution}
                label="Show Solution"
                onChange={() => setShowSolution((prev) => !prev)}
              />
            </div>

            {activeInstances.map((activeInstance) => {
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
                <div className="container">
                  <div className="description">{description}</div>
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

                  <div className="info">
                    <div className="possibilities">
                      <Possibilities
                        data={results.data}
                        questionOptions={options}
                        questionType={question.type}
                        showGraph={true}
                        showSolution={showSolution}
                      />
                    </div>
                    <div className="totalResponses">
                      <FormattedMessage id="evaluation.totalParticipants.label" defaultMessage="Total participants:" />{' '}
                      {results.totalResponses}
                    </div>
                    <div className="visualizationType noPrint">
                      <VisualizationType
                        activeVisualization={activeVisualization}
                        questionType={question.type}
                        onChangeType={(type, newVisualization) =>
                          setActiveVisualizations((currentState) => ({ ...currentState, [type]: newVisualization }))
                        }
                      />
                    </div>
                  </div>
                </div>
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
                margin: 0;
              }

              .actions {
                padding: 0.5rem;
              }

              .container {
                position: relative;
                height: 1190px;
                width: 1704px;

                padding: 25px;

                page-break-after: always;
              }

              .description {
                height: 120px;

                background-color: $color-primary-background;
                border-top: 2px solid $color-primary;
                border-bottom: 2px solid $color-primary;
                font-weight: bold;
                font-size: 1em;
                padding: 0.7em;
                text-align: left;
              }

              .chart {
                height: 1020px;
                width: 1100px;

                :global(.tableChart) {
                  padding: 1em;
                }
              }

              .info {
                position: absolute;
                top: 170px;
                left: 1100px;
                height: 1020px;
                width: 464px;

                padding: 1em;

                :global(h2) {
                  font-size: 1rem !important;
                }

                :global(*) {
                  font-size: 0.7rem;
                }
              }

              .possibilities {
                margin-bottom: 0.7em;
              }

              .totalResponses {
                margin-bottom: 0.7em;
              }

              .noPrint {
                @media print {
                  display: none;
                }

                :global(button) {
                  margin: 0;
                }
              }
            `}</style>
          </CommonLayout>
        )
      }}
    </LoadSessionData>
  )
}

export default withApollo()(Print)
