import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

const propTypes = {
  handleChange: PropTypes.func.isRequired,
  title: PropTypes.element,
  value: PropTypes.number,
}

const defaultProps = {
  title: undefined,
  value: undefined,
}

const ConfusionSlider = ({ title, value, handleChange }) => (
  <div className="confusionSlider">
    <Helmet defer={false}>
      {createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}
    </Helmet>

    {title && <div className="title">{title}</div>}

    <div className="slider">
      <Slider min={-50} max={50} orientation="horizontal" value={value} onChange={handleChange} />
    </div>

    <style jsx>{`
      .title > :global(*:first-child) {
        font-size: 1rem;
        margin: 0;
      }
    `}</style>
  </div>
)

ConfusionSlider.propTypes = propTypes
ConfusionSlider.defaultProps = defaultProps

export default ConfusionSlider
