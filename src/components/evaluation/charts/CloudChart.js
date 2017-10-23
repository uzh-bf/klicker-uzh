import React from 'react'
import PropTypes from 'prop-types'
import WordCloud from 'react-d3-cloud'

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

function CloudChart({ data }) {
  const fontSizeMapper = word => Math.log2(word.value) * 5
  const rotate = word => word.value % 360

  return (
    <div className="cloudChart">
      <WordCloud
        data={data.map(row => ({ text: row.value, value: row.count }))}
        fontSizeMapper={fontSizeMapper}
        rotate={rotate}
      />

      <style jsx>{`
        .cloudChart {
          width: 100%;
        }
      `}</style>
    </div>
  )
}

CloudChart.propTypes = propTypes
CloudChart.defaultProps = defaultProps

export default CloudChart
