import React from 'react'
import PropTypes from 'prop-types'
import WordCloud from 'react-d3-cloud'
import { shouldUpdate } from 'recompose'

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      count: PropTypes.number.isRequired,
      value: PropTypes.string.isRequired,
    })
  ),
  size: PropTypes.shape({
    width: PropTypes.number.isRequired,
  }).isRequired,
}
const defaultProps = {
  data: [],
}

const fontSizeMapper = word => (1 + Math.log2(word.value)) * 40
const rotate = word => word.value % 90

const CloudChart = ({ data, size }) => (
  <div className="cloudChart">
    <WordCloud
      data={data.map(({ value, count }) => ({ text: value, value: count }))}
      fontSizeMapper={fontSizeMapper}
      height={600}
      rotate={rotate}
      width={size.width || 600}
    />

    <style jsx>
      {`
        .cloudChart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
        }
      `}
    </style>
  </div>
)

CloudChart.propTypes = propTypes
CloudChart.defaultProps = defaultProps

export default shouldUpdate(
  (props, nextProps) => props.size.width !== nextProps.size.width || props.data.length !== nextProps.data.length
)(CloudChart)
