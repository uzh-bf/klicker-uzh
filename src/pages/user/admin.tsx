import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import _debounce from 'lodash/debounce'

import useSortingAndFiltering from '../../lib/hooks/useSortingAndFiltering'
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

function Admin(): React.ReactElement {
  useLogging({ slaask: true })

  const { handleSearch, filters } = useSortingAndFiltering()

  const intl = useIntl()

  return (
    <TeacherLayout
      navbar={{
        search: {
          handleSearch: _debounce(handleSearch, 200),
        },
        title: intl.formatMessage(messages.title),
      }}
      pageTitle={intl.formatMessage(messages.pageTitle)}
      sidebar={{ activeItem: 'sessionList' }}
    >
      <AdminArea filters={filters} />
    </TeacherLayout>
  )
}

export default withApollo()(Admin)
