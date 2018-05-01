import React from 'react'
import PropTypes from 'prop-types'
import { compose, withProps } from 'recompose'
import QRCode from 'qrcode.react'

import { StaticLayout } from '../components/layouts'
import { withLogging } from '../lib'

const propTypes = {
  shortname: PropTypes.string.isRequired,
}

const QR = ({ shortname }) => (
  <StaticLayout pageTitle="QR">
    <div className="qr">
      <QRCode size={512} value={`https://beta.klicker.uzh.ch/join/${shortname}`} />
    </div>

    <style jsx>{`
      @import 'src/theme';

      .qr {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `}</style>
  </StaticLayout>
)
QR.propTypes = propTypes

export default compose(
  withLogging(),
  withProps(({ url }) => ({
    shortname: url.query.shortname,
  })),
)(QR)
