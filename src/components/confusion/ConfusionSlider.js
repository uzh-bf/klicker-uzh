import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

const propTypes = {
  handleChange: PropTypes.func.isRequired,
  handleChangeComplete: PropTypes.func.isRequired,
  title: PropTypes.element,
  value: PropTypes.number,
}

const defaultProps = {
  title: undefined,
  value: undefined,
}

const ConfusionSlider = ({
  title, value, handleChange, handleChangeComplete,
}) => {
  const min = -10
  const max = 10

  const labels = {
    min: 'Low',
    0: 'Medium',
    9: 'High',
  }

  return (
    <div className="confusionSlider">
      <Helmet defer={false}>
        {createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}
      </Helmet>

      {title && <div className="title">{title}</div>}

      <div className="slider">
        <Slider
          min={min}
          max={max}
          tooltip={false}
          value={value}
          onChange={handleChange}
          onChangeComplete={handleChangeComplete}
          labels={labels}
          handleLabel={value}
        />
      </div>

      <style jsx>{`
        .confusionSlider {
          margin-bottom: 70px;

          .title > :global(*):first-child {
            font-size: 1rem;
            margin: 0;
          }

          :global(.rangeslider__handle) {
            padding: 1rem;

            &:after {
              display: none;
            }

            &:focus {
              outline: none;
            }
          }

          :global(.rangeslider__handle-label) {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate3d(-50%, -50%, 0);
          }
        }
      `}</style>
    </div>
  )
}

ConfusionSlider.propTypes = propTypes
ConfusionSlider.defaultProps = defaultProps

export default ConfusionSlider
