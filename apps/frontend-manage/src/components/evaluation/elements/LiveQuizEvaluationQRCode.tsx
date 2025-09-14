import { faX } from '@fortawesome/free-solid-svg-icons'
import { LocaleType } from '@klicker-uzh/graphql/dist/ops'
import QR from '@pages/qr/[...args]'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'

function LiveQuizEvaluationQRCode({
  setHideQR,
  language,
}: {
  setHideQR: Dispatch<SetStateAction<boolean>>
  language?: LocaleType | null
}) {
  const router = useRouter()
  const liveQuizRelativeLink = `${language ? `/${language}` : ''}/session/${router.query.id}`

  return (
    <div className="group relative float-end hidden h-max w-full items-center justify-center lg:flex">
      <QR
        className={{
          root: 'mx-auto self-center bg-blue-400',
          title: 'text-base',
          canvas: 'h-40 w-40',
        }}
        path={liveQuizRelativeLink}
        showLink={false}
        showButton={false}
        showLogo={false}
      />
      <Button
        className={{
          root: 'absolute right-0 top-0 hidden h-9 group-hover:block',
        }}
        onClick={() => setHideQR(true)}
      >
        <Button.Icon withoutLabel icon={faX} />
      </Button>
    </div>
  )
}

export default LiveQuizEvaluationQRCode
