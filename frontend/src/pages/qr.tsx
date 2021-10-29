import React from 'react'
import getConfig from 'next/config'
import { QRCode } from 'react-qrcode-logo'
import { useRouter } from 'next/router'

import StaticLayout from '../components/layouts/StaticLayout'
import useLogging from '../lib/hooks/useLogging'

const { publicRuntimeConfig } = getConfig()

function QR(): React.ReactElement {
  useLogging()

  const router = useRouter()

  const { shortname } = router.query

  const joinLink = publicRuntimeConfig.joinUrl
    ? `${publicRuntimeConfig.joinUrl}/${shortname}`
    : `${publicRuntimeConfig.baseUrl}/join/${shortname}`

  return (
    <StaticLayout pageTitle="QR">
      <div className="link">{joinLink.replace(/^https?:\/\//, '')}</div>
      <div className="qr">
        <QRCode
          eyeRadius={20}
          logoHeight={100}
          logoImage="https://www.klicker.uzh.ch/docs/img/KlickerUZH_Gray_BG.png"
          logoWidth={300}
          size={700}
          value={`${publicRuntimeConfig.baseUrl}/join/${shortname}`}
        />
      </div>

      <style jsx>{`
        @import 'src/theme';

        .link {
          line-height: 4rem;
          font-size: ${publicRuntimeConfig.joinUrl ? '5rem' : '4rem'};
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

export default QR
