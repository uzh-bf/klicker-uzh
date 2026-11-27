import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import EscapeProjectorView from '../../../../../components/evaluation/EscapeProjectorView'

function GroupActivityEscapeProjector() {
  const router = useRouter()

  if (!router.isReady) return null

  return (
    <EscapeProjectorView
      variables={{
        groupActivityId: router.query.id as string,
        digest: router.query.digest as string | undefined,
      }}
    />
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default GroupActivityEscapeProjector
