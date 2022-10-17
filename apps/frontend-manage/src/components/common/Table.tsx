import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface column {
  label: string
  accessor: string
  sortable: boolean
}

interface TableProps {
  className?: string
  columns: column[]
  data: Record<string, string | number>[]
  caption?: string
}

export function Table({ className, columns, data, caption }: TableProps) {
  const [tableData, setTableData] = useState(data)
  const [sortField, setSortField] = useState('')
  const [order, setOrder] = useState('asc')

  useEffect(() => {
    setTableData(data)
  }, [data])

  const handleSorting = (sortField: string, sortOrder: string) => {
    if (sortField) {
      const sorted = [...tableData].sort((a, b) => {
        if (a[sortField] === null) return 1
        if (b[sortField] === null) return -1
        if (a[sortField] === null && b[sortField] === null) return 0
        return (
          a[sortField].toString().localeCompare(b[sortField].toString(), 'en', {
            numeric: true,
          }) * (sortOrder === 'asc' ? 1 : -1)
        )
      })
      setTableData(sorted)
    }
  }

  const handleSortingChange = (accessor: string) => {
    const sortOrder = accessor === sortField && order === 'asc' ? 'desc' : 'asc'
    setSortField(accessor)
    setOrder(sortOrder)
    handleSorting(accessor, sortOrder)
  }

  return (
    <div className={twMerge('table w-full p-4', className)}>
      <table className="w-full table-auto">
        <caption className="text-sm italic">{caption}</caption>
        <thead>
          <tr>
            {columns.map(({ label, accessor, sortable }) => {
              return (
                <th
                  key={accessor}
                  onClick={
                    sortable ? () => handleSortingChange(accessor) : undefined
                  }
                  className={twMerge(
                    'pt-8 pb-2 pr-10 mr-20 border-b-2 text-lg border-b-gray-800 text-start text-gray-800',
                    sortable && 'cursor-pointer'
                  )}
                >
                  {sortable && (
                    <FontAwesomeIcon
                      className={twMerge(
                        'mr-2',
                        !(sortField === accessor) && 'text-uzh-grey-100'
                      )}
                      icon={
                        sortField === accessor
                          ? order === 'asc'
                            ? faSortUp
                            : faSortDown
                          : faSort
                      }
                    />
                  )}
                  {label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {tableData.map((d, index) => {
            return (
              <tr key={index} className="odd:bg-uzh-grey-20 first:border-t-0">
                {columns.map(({ accessor }) => {
                  const tData = d[accessor] ? d[accessor] : '——'
                  return (
                    <td
                      className="p-4 border-t-2 border-uzh-grey-60"
                      key={accessor}
                    >
                      {tData}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default Table
