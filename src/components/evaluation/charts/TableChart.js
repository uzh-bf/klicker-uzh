import React from 'react'
import PropTypes from 'prop-types'
import Griddle, { plugins, RowDefinition, ColumnDefinition } from 'griddle-react'
import { QUESTION_GROUPS } from '../../../constants'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      percentage: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
  isSolutionShown: PropTypes.bool,
  questionType: PropTypes.string.isRequired,
}

const defaultProps = {
  data: [],
  isSolutionShown: false,
}

// define a custom layout
// we don't need Filter and SettingsWrapper
function Layout({ Table, Pagination }) {
  return (
    <div>
      <Table />
      <Pagination />
    </div>
  )
}
Layout.propTypes = {
  Pagination: PropTypes.element.isRequired,
  Table: PropTypes.element.isRequired,
}

function ColumnWithSolution({ value }) {
  return <span>{value ? 'T' : 'F'}</span>
}
ColumnWithSolution.propTypes = {
  value: PropTypes.bool.isRequired,
}

// virtual scrolling: use plugins.PositionPlugin({ tableHeight: 500 })?
function TableChart({ data, isSolutionShown, questionType }) {
  return (
    <div className="tableChart">
      <Griddle
        components={{
          Layout,
        }}
        data={data}
        plugins={[plugins.LocalPlugin]}
        // sortProperties={[{ id: 'count', sortAscending: false }]}
      >
        <RowDefinition>
          <ColumnDefinition
            cssClassName="griddle-cell countColumn"
            id="count"
            title="Count"
            width="3rem"
          />

          <ColumnDefinition id="value" title="Value" />

          {QUESTION_GROUPS.WITH_PERCENTAGES.includes(questionType) && (
            <ColumnDefinition
              cssClassName="griddle-cell percentageColumn"
              headerCssClassName="griddle-table-heading-cell percentageColumn"
              id="percentage"
              title="%"
              width="2rem"
            />
          )}

          <ColumnDefinition
            cssClassName="griddle-cell solutionColumn"
            customComponent={ColumnWithSolution}
            headerCssClassName="griddle-table-heading-cell solutionColumn"
            id="correct"
            title="T/F"
            width="1rem"
          />
        </RowDefinition>
      </Griddle>

      <style jsx>{`
        .tableChart {
          width: 100%;

          :global(.griddle-table) {
            width: 100%;
          }

          :global(.griddle-table-heading) {
            background-color: lightgrey;
          }

          :global(.griddle-table-heading-cell, .griddle-cell) {
            font-size: 1.25rem;
            padding: 0.5rem;
            text-align: left;
          }

          :global(.countColumn, .solutionColumn, .percentageColumn) {
            text-align: center;
          }

          :global(.solutionColumn) {
            display: ${isSolutionShown ? 'table-cell' : 'none'};
          }

          :global(.griddle-row:nth-child(2n)) {
            background-color: #efefef;
          }

          :global(.griddle-pagination) {
            margin-top: 5px;

            :global(.griddle-page-select) {
              margin-left: 5px;
            }
          }
        }
      `}</style>
    </div>
  )
}

TableChart.propTypes = propTypes
TableChart.defaultProps = defaultProps

export default TableChart
