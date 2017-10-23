import React from 'react'
import PropTypes from 'prop-types'
import WordCloud from 'react-d3-cloud'
import { compose, pure } from 'recompose'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ),
}
const defaultProps = {
  data: [],
}

const fontSizeMapper = word => Math.log2(word.value) * 50
const rotate = word => word.value % 360

const CloudChart = ({ data }) => (
  <div className="cloudChart">
    <WordCloud
      data={data.map(row => ({ text: row.value, value: row.count }))}
      fontSizeMapper={fontSizeMapper}
      rotate={rotate}
      height={500}
      width={500}
    />

    <style jsx>{`
        .cloudChart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
        }
      `}</style>
  </div>
)

CloudChart.propTypes = propTypes
CloudChart.defaultProps = defaultProps

export default compose(pure)(CloudChart)
