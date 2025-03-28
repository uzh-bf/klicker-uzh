import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import QR from '~/pages/qr/[...args]'

function QRCodePopover({
  relHref,
  data,
}: {
  relHref: string
  data?: { cy?: string; test?: string }
}) {
  const t = useTranslations()

  return (
    <Popover>
      <PopoverTrigger className="hover:bg-accent text-primary-100 mb-1 flex flex-row items-center gap-2.5 rounded px-2 py-0 text-sm">
        <FontAwesomeIcon icon={faQrcode} />
        <div>{t('manage.general.qrCode')}</div>
      </PopoverTrigger>
      <PopoverContent className="w-max">
        <QR
          className={{
            title: 'mt-0 w-80 text-center text-sm',
            canvas: 'flex justify-center',
          }}
          path={relHref}
          width={100}
        />
        <Link passHref href={`/qr${relHref}`} target="_blank">
          <Button fluid primary className={{ root: 'mt-2' }} data={data}>
            <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
          </Button>
        </Link>
      </PopoverContent>
    </Popover>
  )
}

export default QRCodePopover
