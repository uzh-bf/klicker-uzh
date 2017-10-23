import React from 'react'
import PropTypes from 'prop-types'
import Griddle, { plugins, RowDefinition, ColumnDefinition } from 'griddle-react'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      text: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  data: [],
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

// virtual scrolling: use plugins.PositionPlugin({ tableHeight: 500 })?
function TableChart({ data }) {
  return (
    <div className="tableChart">
      <Griddle
        data={data}
        plugins={[plugins.LocalPlugin]}
        sortProperties={[{ id: 'count', sortAscending: false }]}
        components={{
          Layout,
        }}
      >
        <RowDefinition>
          <ColumnDefinition id="value" title="Value" width="80%" />
          <ColumnDefinition id="count" title="Count" width="20%" />
        </RowDefinition>
      </Griddle>

      <style jsx>{`
        .tableChart :global(.griddle-table) {
          width: 100%;

          :global(.griddle-table-heading) {
            background-color: lightgrey;
          }

          :global(.griddle-table-heading-cell, .griddle-cell) {
            padding: 0.5rem;
            text-align: left;
          }
        }
      `}</style>
    </div>
  )
}

TableChart.propTypes = propTypes
TableChart.defaultProps = defaultProps

export default TableChart
