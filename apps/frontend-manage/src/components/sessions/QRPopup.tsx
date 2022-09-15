import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import getConfig from 'next/config'
import Link from 'next/link'
import React from 'react'
import { QRCode } from 'react-qrcode-logo'

const { publicRuntimeConfig } = getConfig()

interface Props {
  id: string
}

function QRPopup({ id }: Props): React.ReactElement {
  const joinUrl = publicRuntimeConfig.joinUrl
    ? `${publicRuntimeConfig.joinUrl}/${id}`
    : `${publicRuntimeConfig.baseUrl}/join/${id}`

  return (
    <Modal
      className="bottom right"
      trigger={
        <Button
          className="w-[41%] sm:w-max !mr-0"
          labelPosition="left"
          size="small"
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
          QR Code
        </Button>
      }
    >
      <div>
        <div className="font-bold">
          <Link href={joinUrl}>{joinUrl}</Link>
        </div>

        <div>
          <QRCode
            logoHeight={40}
            logoImage="https://www.klicker.uzh.ch/img/KlickerUZH_Gray_BG.png"
            logoWidth={120}
            size={300}
            value={`${publicRuntimeConfig.baseUrl}/join/${id}`}
          />
        </div>

        <Link passHref href={`/qr/${id}`}>
          <a target="_blank">
            <Button
              fluid
              className="text-lg font-bold text-white bg-uzh-blue-80 h-11"
            >
              <Button.Label>QR-Code präsentieren</Button.Label>
            </Button>
          </a>
        </Link>
      </div>
    </Modal>
  )
}

export default QRPopup
