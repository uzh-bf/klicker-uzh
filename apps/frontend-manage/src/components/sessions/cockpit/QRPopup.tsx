import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import QR from '@pages/qr/[...args]'
import { Button, Modal } from '@uzh-bf/design-system'
import getConfig from 'next/config'
import Link from 'next/link'
import React, { useState } from 'react'

const { publicRuntimeConfig } = getConfig()

interface Props {
  id: string
}

function QRPopup({ id }: Props): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Modal
      className="bottom right"
      trigger={
        <Button
          className="w-[41%] sm:w-max !mr-0"
          onClick={() => setModalOpen(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
          QR Code
        </Button>
      }
      open={modalOpen}
      onClose={() => setModalOpen(false)}
    >
      <div>
        <div className="font-bold">
          <Link
            href={`https://pwa.klicker.uzh.ch/session/${id}`}
          >{`https://pwa.klicker.uzh.ch/session/${id}`}</Link>
        </div>

        <div>
          <QR path={`/session/${id}`} width={200} />
        </div>

        <Link passHref href={`/qr/session/${id}`}>
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
