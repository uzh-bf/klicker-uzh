import Head from 'next/head'
import React from 'react'
import Slider from 'react-rangeslider'
import { createLinks } from '../../lib/utils/css'

interface Props {
  handleChange: any
  handleChangeComplete: any
  labels?: any
  max: number
  min: number
  title: React.ReactNode
  value?: number
}

const defaultProps = {
  labels: undefined,
  title: undefined,
  value: undefined,
}

function ConfusionSlider({
  title,
  value,
  handleChange,
  handleChangeComplete,
  min,
  max,
  labels,
}: Props): React.ReactElement {
  const labelsSlider = {}
  labelsSlider[min] = labels.min
  labelsSlider[(max + min) / 2] = labels.mid
  labelsSlider[max] = labels.max

  return (
    <div className="confusionSlider">
      <Head>{createLinks(['https://unpkg.com/react-rangeslider/umd/rangeslider.min.css'])}</Head>

      {title && <div className="title">{title}</div>}

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

      <style jsx>{`
        @import 'src/theme';

        .confusionSlider {
          .title > :global(*):first-child {
            font-size: 1rem !important;
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
      `}</style>
    </div>
  )
}

ConfusionSlider.defaultProps = defaultProps

export default ConfusionSlider
