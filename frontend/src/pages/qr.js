import React from 'react'
import PropTypes from 'prop-types'
import { compose, withProps } from 'recompose'
import QRCode from 'qrcode.react'
import { withRouter } from 'next/router'

import { StaticLayout } from '../components/layouts'
import { withLogging } from '../lib'

const propTypes = {
  shortname: PropTypes.string.isRequired,
}

const QR = ({ shortname }) => {
  const joinLink = `${process.env.APP_BASE_URL}/join/${shortname}`

  return (
    <StaticLayout pageTitle="QR">
      <div className="link">{joinLink.replace(/^https?:\/\//,'')}</div>
      <div className="qr">
        <QRCode size={700} value={joinLink} />
      </div>

      <style jsx>{`
        @import 'src/theme';

        .link {
          line-height: 4rem;
          font-size: 4rem;
          font-weight: bold;
          margin-bottom: 2rem;
        }

        .qr {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </StaticLayout>
  )
}
QR.propTypes = propTypes

export default compose(
  withRouter,
  withLogging(),
  withProps(({ router }) => ({
    shortname: router.query.shortname,
  }))
)(QR)
