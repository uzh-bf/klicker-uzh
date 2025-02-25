import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import UserGroupsManagement from '../../components/catalog/UserGroupsManagement'
import Layout from '../../components/Layout'

function UserGroupsPage() {
  const t = useTranslations()

  return (
    <Layout displayName={t('manage.general.userGroups')}>
      <UserGroupsManagement />
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

export default UserGroupsPage
