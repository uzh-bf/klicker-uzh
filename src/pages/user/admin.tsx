import _debounce from 'lodash/debounce'
import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import AdminArea from '../../components/admin/AdminArea'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { withApollo } from '../../lib/apollo'
import useLogging from '../../lib/hooks/useLogging'
import useSortingAndFiltering from '../../lib/hooks/useSortingAndFiltering'

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
      sidebar={{ activeItem: 'admin' }}
    >
      <AdminArea filters={filters} />
    </TeacherLayout>
  )
}

export default withApollo()(Admin)
