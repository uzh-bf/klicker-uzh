import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import QR from '@pages/qr/[...args]'
import { Button, Modal, ThemeContext } from '@uzh-bf/design-system'
import Link from 'next/link'
import React, { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface QRPopupProps {
  link?: string
  relativeLink: string
  triggerText?: string
  className?: {
    button?: string
    modal?: string
  }
  children?: React.ReactNode
}

interface QRPopupPropsWithLink extends QRPopupProps {
  link: string
  children?: never
}
interface QRPopupPropsWithChildren extends QRPopupProps {
  link?: never
  children: React.ReactNode
}

function QRPopup({
  link,
  relativeLink,
  triggerText,
  className,
  children,
}: QRPopupPropsWithLink | QRPopupPropsWithChildren): React.ReactElement {
  const theme = useContext(ThemeContext)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Modal
      trigger={
        <Button
          className={{ root: 'w-[41%] sm:w-max !mr-0' }}
          onClick={() => setModalOpen(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
          {triggerText || 'QR Code'}
        </Button>
      }
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      className={{
        content: className?.modal,
      }}
    >
      {children || (
        <div className="flex flex-row gap-1 font-bold">
          <div>Link:</div>
          <Link href={link || ''} className={theme.primaryText} target="_blank">
            {link}
          </Link>
        </div>
      )}

      <div>
        <QR path={relativeLink} width={200} />
      </div>

      <Link passHref href={`/qr/${relativeLink}`} target="_blank">
        <Button
          fluid
          className={{
            root: twMerge(
              'text-lg font-bold text-white h-11',
              theme.primaryBgDark,
              className?.button
            ),
          }}
        >
          <Button.Label>QR-Code präsentieren</Button.Label>
        </Button>
      </Link>
    </Modal>
  )
}

export default QRPopup
