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
  dataTrigger?: {
    cy?: string
    test?: string
  }
  dataModal?: {
    cy?: string
    test?: string
  }
  dataCloseButton?: {
    cy?: string
    test?: string
  }
}

interface QRPopupPropsWithLink extends QRPopupProps {
  link: string
  children?: never
}
interface QRPopupPropsWithChildren extends QRPopupProps {
  link?: never
  children: React.ReactNode
}

function CourseQRModal({
  link,
  relativeLink,
  triggerText,
  className,
  children,
  dataTrigger,
  dataModal,
  dataCloseButton,
}: QRPopupPropsWithLink | QRPopupPropsWithChildren): React.ReactElement {
  const t = useTranslations()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Modal
      title="QR Code"
      trigger={
        <Button
          className={{ root: 'w-[41%] sm:w-max !mr-0' }}
          onClick={() => setModalOpen(true)}
          data={dataTrigger}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
          {triggerText || t('manage.general.qrCode')}
        </Button>
      }
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      className={{
        content: className?.modal,
      }}
      dataOverlay={dataModal}
      dataCloseButton={dataCloseButton}
    >
      <div>
        <QR
          className={{ title: 'text-base' }}
          path={relativeLink}
          width={100}
        />
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
          data={{ cy: 'present-qr-code-button' }}
        >
          <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
        </Button>
      </Link>
    </Modal>
  )
}

export default CourseQRModal
