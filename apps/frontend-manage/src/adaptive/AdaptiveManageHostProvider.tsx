import type { AdaptivePaginationProps } from '@klicker-uzh/adaptive-manage-ui/ports'
import {
  type AdaptiveManageHostPorts,
  AdaptiveManageHostProvider,
} from '@klicker-uzh/adaptive-manage-ui/ports'
import CreationFormValidator from '../components/activities/creation/CreationFormValidator'
import WizardNavigation from '../components/activities/creation/WizardNavigation'
import Pagination, {
  type PaginationPageSize,
} from '../components/common/Pagination'
import Layout from '../components/Layout'

function AdaptivePagination({
  pageSize,
  setPageSize,
  ...props
}: AdaptivePaginationProps) {
  return (
    <Pagination
      {...props}
      pageSize={pageSize as PaginationPageSize}
      setCurrentPage={(value) =>
        props.setCurrentPage(
          typeof value === 'function' ? value(props.currentPage) : value
        )
      }
      setPageSize={(value) => {
        if (typeof value === 'number') setPageSize(value)
      }}
    />
  )
}

export const adaptiveManageHostPorts: AdaptiveManageHostPorts = {
  Layout,
  Pagination: AdaptivePagination,
  CreationFormValidator,
  WizardNavigation,
}
export { AdaptiveManageHostProvider }
