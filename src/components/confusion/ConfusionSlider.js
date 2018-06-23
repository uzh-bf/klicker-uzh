import React from 'react'
import PropTypes from 'prop-types'
import Slider from 'react-rangeslider'
import Head from 'next/head'

import { createLinks } from '../../lib'

const propTypes = {
  handleChange: PropTypes.func.isRequired,
  handleChangeComplete: PropTypes.func.isRequired,
  labels: PropTypes.object,
  max: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  title: PropTypes.element,
  value: PropTypes.number,
}

const defaultProps = {
  labels: undefined,
  title: undefined,
  value: undefined,
}

const ConfusionSlider = ({
  title,
  value,
  handleChange,
  handleChangeComplete,
  min,
  max,
  labels,
}) => {
  const labelsSlider = {}
  labelsSlider[min] = labels.min
  labelsSlider[(max + min) / 2] = labels.mid
  labelsSlider[max] = labels.max

  return (
    <div className="confusionSlider">
      <Head>
        {createLinks([
          'https://unpkg.com/react-rangeslider/umd/rangeslider.min.css',
        ])}
      </Head>

      {title && (
      <div className="title">
        {title}
      </div>
      )}

      <div className="slider">
        <Slider
          handleLabel={value}
          labels={labelsSlider}
          max={max}
          min={min}
          tooltip={false}
          value={value}
          onChange={handleChange}
          onChangeComplete={handleChangeComplete}
        />
      </div>

      <style jsx>
        {`
          @import 'src/theme';

          .confusionSlider {
            .title > :global(*):first-child {
              font-size: 1rem;
              margin: 0;
            }

            :global(.rangeslider__fill) {
              background-color: $color-primary;
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
        `}
      </style>
    </div>
  )
}

ConfusionSlider.propTypes = propTypes
ConfusionSlider.defaultProps = defaultProps

export default ConfusionSlider
