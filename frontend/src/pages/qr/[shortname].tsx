import React from 'react'
import getConfig from 'next/config'
import { QRCode } from 'react-qrcode-logo'

import StaticLayout from '../../components/layouts/StaticLayout'

const { publicRuntimeConfig } = getConfig()

function QR({ shortname }): React.ReactElement {
  const joinLink = publicRuntimeConfig.joinUrl
    ? `${publicRuntimeConfig.joinUrl}/${shortname}`
    : `${publicRuntimeConfig.baseUrl}/join/${shortname}`

  return (
    <StaticLayout pageTitle="QR">
      <div className="mb-8 text-lg font-bold link">{joinLink.replace(/^https?:\/\//, '')}</div>
      <div className="flex items-center justify-center">
        <QRCode
          logoHeight={100}
          logoImage="https://www.klicker.uzh.ch/docs/img/KlickerUZH_Gray_BG.png"
          logoWidth={300}
          size={700}
          value={joinLink}
        />
      </div>
    </StaticLayout>
  )
}

export async function getStaticProps({ params }) {
  return {
    props: {
      shortname: params.shortname,
    },
  }
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: true,
  }
}

export default QR
