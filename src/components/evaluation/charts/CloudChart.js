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

const fontSizeMapper = word => (1 + Math.log2(word.value)) * 40
const rotate = word => word.value % 90

const CloudChart = ({ data }) => (
  <div className="cloudChart">
    <WordCloud
      data={data.map(({ value, count }) => ({ text: value, value: count }))}
      fontSizeMapper={fontSizeMapper}
      height={600}
      rotate={rotate}
      width={800}
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
