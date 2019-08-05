/* eslint-disable */
import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { defineMessages, intlShape } from 'react-intl'
import { compose, withProps, withStateHandlers, branch, renderComponent, renderNothing } from 'recompose'
import { withRouter } from 'next/router'
import { graphql } from 'react-apollo'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'

import { CHART_DEFAULTS, QUESTION_GROUPS, QUESTION_TYPES, SESSION_STATUS } from '../../constants'
import { toValueArray, pageWithIntl, withLogging } from '../../lib'
import { Chart, Possibilities } from '../../components/evaluation'
import { SessionEvaluationQuery, SessionEvaluationPublicQuery } from '../../graphql'
import { sessionStatusShape, statisticsShape } from '../../propTypes'
import { CommonLayout } from '../../components/layouts'
import { extractInstancesFromSession } from './evaluation'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'PdfPrint',
    id: 'evaluation.pageTitle',
  },
})

const propTypes = {
  activeInstance: PropTypes.object.isRequired,
  activeInstanceIndex: PropTypes.number,
  activeVisualizations: PropTypes.object.isRequired,
  bins: PropTypes.number.isRequired,
  handleChangeActiveInstance: PropTypes.func.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  instanceSummary: PropTypes.arrayOf(PropTypes.object),
  intl: intlShape.isRequired,
  isPublic: PropTypes.bool.isRequired,
  sessionId: PropTypes.string.isRequired,
  sessionStatus: sessionStatusShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  statistics: statisticsShape,
  visualizationType: PropTypes.string.isRequired,
}
const defaultProps = {
  activeInstanceIndex: 0,
  instanceSummary: [],
  statistics: undefined,
}

const divStyle = {
  heigth: '100%',
}

function Print({ activeInstances, instanceSummary, intl, isPublic, sessionId, sessionStatus }) {
  // useEffect(() => {
  //   setTimeout(() => {
  //     window.print()
  //   }, 1000)
  // })

  const activeVisualizations = CHART_DEFAULTS

  return activeInstances.map(activeInstance => {
    if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
      // convert the result data into an array with primitive numbers
      const valueArray = toValueArray(activeInstance.results.data)
      const hasResults = valueArray.length > 0

      activeInstance.statistics = {
        bins,
        max: hasResults && max(valueArray),
        mean: hasResults && mean(valueArray),
        median: hasResults && median(valueArray),
        min: hasResults && min(valueArray),
        onChangeBins: e => setBins(+e.target.value),
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

    console.log(results)

    return (
      <>
        <div className="description">{description}</div>
        <div className="flexContainer">
          <div className="chart">
            <Chart
              activeVisualization={activeVisualizations[question.type]}
              data={results.data}
              instanceId={activeInstance.id}
              intl={intl}
              isPublic={false}
              numBins={null}
              questionType={question.type}
              restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
              sessionId={sessionId}
              sessionStatus={sessionStatus}
              showGraph={true}
              showSolution={false}
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
              showSolution={true}
            />
            Total responses: {results.totalResponses}
          </div>
        </div>

        <style jsx global>{`
          html {
            font-size: 1em;
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

            page-break-after: always;
          }

          .flexContainer {
            display: flex;
            flex-flow: row nowrap;
          }

          .possibilities {
            flex: 1;
            padding: 1em;
            border-bottom: 1px solid lightgrey;
          }

          .chart {
            flex: 1;
            height: 30em;
          }
        `}</style>
      </>
    )
  })
}

Print.propTypes = propTypes
Print.defaultProps = defaultProps

export default compose(
  withRouter,
  pageWithIntl,
  withProps(({ router }) => ({
    isPublic: !!router.query.public,
    sessionId: router.query.sessionId,
  })),
  branch(
    ({ isPublic }) => isPublic,
    graphql(SessionEvaluationPublicQuery, {
      options: ({ sessionId }) => ({
        variables: { sessionId },
      }),
    }),
    graphql(SessionEvaluationQuery, {
      options: ({ sessionId }) => ({
        variables: { sessionId },
      }),
    })
  ),
  // if the query is still loading, display nothing
  branch(
    ({ data: { loading, session, sessionPublic }, isPublic }) =>
      loading || (!isPublic && !session) || (isPublic && !sessionPublic),
    renderNothing
  ),
  // if the session is publicly accessed, override the session with its public counterpart
  withProps(({ data: { session, sessionPublic }, isPublic }) => ({
    session: isPublic ? sessionPublic : session,
  })),
  withProps(({ session }) => extractInstancesFromSession(session))
)(Print)
