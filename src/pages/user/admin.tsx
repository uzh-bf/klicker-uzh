import React from 'react'
import { defineMessages, useIntl } from 'react-intl'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import useLogging from '../../lib/hooks/useLogging'
import { withApollo } from '../../lib/apollo'
import AdminArea from '../../components/admin/AdminArea'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Admin Area',
    id: 'admin.pageTitle',
  },
  title: {
    defaultMessage: 'Admin Area',
    id: 'admin.title',
  },
})

function Settings(): React.ReactElement {
  useLogging({ slaask: true })

  const intl = useIntl()

  return (
    <TeacherLayout
      navbar={{ title: intl.formatMessage(messages.title) }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'sessionList' }}
    >
      <AdminArea />
    </TeacherLayout>
  )
}

export default withApollo()(Settings)
