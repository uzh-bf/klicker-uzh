import getConfig from 'next/config'
import React from 'react'
import { QRCode } from 'react-qrcode-logo'

interface Props {
  shortname: string
}

function QR({ shortname }: Props): React.ReactElement {
  return (
    <QRCode
      logoHeight={100}
      logoImage="https://www.klicker.uzh.ch/klicker_logo_v2.png"
      logoWidth={334}
      size={700}
      value={`https://pwa.klicker.uzh.ch/join/${shortname}`}
    />
  )
}

export async function getStaticProps({ params }: { params: Props }) {
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
