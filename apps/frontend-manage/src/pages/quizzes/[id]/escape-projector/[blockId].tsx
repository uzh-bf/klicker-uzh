import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import EscapeProjectorView from '../../../../components/evaluation/EscapeProjectorView'

function EscapeProjector() {
  const router = useRouter()

  if (!router.isReady) return null

  return (
    <EscapeProjectorView
      variables={{
        liveQuizId: router.query.id as string,
        elementBlockId: parseInt(router.query.blockId as string, 10),
        digest: router.query.digest as string | undefined,
      }}
      joinPath={`/session/${router.query.id as string}`}
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

export default EscapeProjector
