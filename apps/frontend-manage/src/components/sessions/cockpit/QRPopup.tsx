import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import QR from '@pages/qr/[...args]'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useState } from 'react'
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
  const t = useTranslations()
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
          {triggerText || t('manage.cockpit.qrCode')}
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
          <div>{t('shared.generic.link')}:</div>
          <Link href={link || ''} className="text-primary" target="_blank">
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
              'text-lg font-bold text-white h-11 bg-primary-80',
              className?.button
            ),
          }}
        >
          <Button.Label>{t('manage.cockpit.presentQrCode')}</Button.Label>
        </Button>
      </Link>
    </Modal>
  )
}

export default QRPopup
