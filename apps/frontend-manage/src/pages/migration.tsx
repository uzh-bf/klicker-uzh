import { useMutation } from '@apollo/client'
import {
  RequestMigrationTokenDocument,
  TriggerMigrationDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'

import Layout from 'src/components/Layout'

function Migration({ query }) {
  const t = useTranslations()

  const [requestMigrationToken] = useMutation(RequestMigrationTokenDocument)
  const [triggerMigration] = useMutation(TriggerMigrationDocument)

  if (query?.token) {
    return (
      <Layout displayName={t('manage.token.pageName')}>
        <div>STEP 1 DONE</div>
        <div>
          <Button
            onClick={() =>
              triggerMigration({
                variables: {
                  token: query.token,
                },
              })
            }
          >
            START MIRATION
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout displayName={t('manage.token.pageName')}>
      <Button
        onClick={() =>
          requestMigrationToken({
            variables: { email: 'rolandschlaefli@gmail.com' },
          })
        }
      >
        Request Migration Token
      </Button>
    </Layout>
  )
}

export default Migration

export async function getServerSideProps({
  query,
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      query,
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`))
        .default,
    },
  }
}
