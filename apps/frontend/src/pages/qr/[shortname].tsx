import React from 'react'
import getConfig from 'next/config'
import { QRCode } from 'react-qrcode-logo'

import StaticLayout from '../../components/layouts/StaticLayout'

const { serverRuntimeConfig } = getConfig()

function QR({ joinLink }): React.ReactElement {
  console.log(joinLink)
  return (
    <StaticLayout pageTitle="QR">
      <div className="mb-8 font-bold text-7xl link">{joinLink?.replace(/^https?:\/\//, '')}</div>
      <div className="flex items-center justify-center">
        <QRCode
          logoHeight={100}
          logoImage="https://www.klicker.uzh.ch/img/KlickerUZH_Gray_BG.png"
          logoWidth={300}
          size={700}
          value={joinLink}
        />
      </div>
    </StaticLayout>
  )
}

export async function getStaticProps({ params }) {
  const joinLink = serverRuntimeConfig.joinUrl
    ? `${serverRuntimeConfig.joinUrl}/${params.shortname}`
    : `${serverRuntimeConfig.baseUrl}/join/${params.shortname}`

  return {
    props: {
      joinLink,
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
