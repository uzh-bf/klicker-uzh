import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import QR from '@pages/qr/[...args]'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
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

function CourseQRModal({
  relativeLink,
  triggerText,
  className,
  dataTrigger,
  dataModal,
  dataCloseButton,
}: QRPopupProps): React.ReactElement {
  const t = useTranslations()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <Modal
      title="QR Code"
      trigger={
        <Button
          className={{ root: '!mr-0 w-full gap-2' }}
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
        content: twMerge('!w-max', className?.modal),
      }}
      dataOverlay={dataModal}
      dataCloseButton={dataCloseButton}
    >
      <UserNotification message={t('manage.course.courseQRDescription')} />

      <div className="mt-4">
        <QR
          className={{
            title: 'text-base',
            canvas: 'flex justify-center',
          }}
          path={relativeLink}
          width={100}
        />
      </div>

      <Link passHref href={`/qr/${relativeLink}`} target="_blank">
        <Button
          fluid
          className={{
            root: twMerge(
              'bg-primary-80 mt-3 h-11 text-lg font-bold text-white',
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
