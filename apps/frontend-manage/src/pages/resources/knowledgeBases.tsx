import { ObjectType } from '@klicker-uzh/graphql/dist/ops'
import { KnowledgeBaseManager } from '@klicker-uzh/kb-management'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import AiBetaUnavailable from '../../components/AiBetaUnavailable'
import Layout from '../../components/Layout'
import ObjectSharingModalWrapper from '../../components/sharing/ObjectSharingModalWrapper'
import { useAiFeaturesEnabled } from '../../lib/hooks/useAiFeaturesEnabled'

function KnowledgeBasesPage() {
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()
  const [sharingTarget, setSharingTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  return (
    <Layout displayName={t('kb.title')}>
      {aiFeaturesEnabled ? (
        <>
          <KnowledgeBaseManager onShare={setSharingTarget} />
          {sharingTarget ? (
            <ObjectSharingModalWrapper
              objectUuid={sharingTarget.id}
              objectName={sharingTarget.name}
              objectType={ObjectType.Kb}
              onClose={() => setSharingTarget(null)}
            />
          ) : null}
        </>
      ) : (
        <AiBetaUnavailable />
      )}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default KnowledgeBasesPage
