import React from 'react'
import getConfig from 'next/config'
import QRCode from 'qrcode.react'
import { useRouter } from 'next/router'

import { withApollo } from '../lib/apollo'
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
        <QRCode size={700} value={`${publicRuntimeConfig.baseUrl}/join/${shortname}`} />
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

export default withApollo({ ssr: true })(QR)
