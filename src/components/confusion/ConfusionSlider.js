// @flow

import * as React from 'react'
import Slider from 'react-rangeslider'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

type Props = {
  title: React.Element<any>,
  value: ?number,
  handleChange: (newValue: number) => mixed,
}

const defaultProps = {
  title: undefined,
  value: undefined,
}

const ConfusionSlider = ({ title, value, handleChange }: Props) =>
  (<div className="confusionSlider">
    <Helmet>
      {createLinks(['https://unpkg.com/react-rangeslider@2.1.0/umd/randeslider.min.css'])}
    </Helmet>

    {title &&
      <div className="title">
        {title}
      </div>}

    <div className="slider">
      <Slider min={-50} max={50} orientation="horizontal" value={value} onChange={handleChange} />
    </div>

    <style jsx>{`
      .title > :global(*:first-child) {
        font-size: 1rem;
        margin: 0;
      }
    `}</style>
  </div>)

ConfusionSlider.defaultProps = defaultProps

export default ConfusionSlider
