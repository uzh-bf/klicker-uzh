import React from 'react'
import { defineMessages, useIntl } from 'react-intl'
import { Input } from 'semantic-ui-react'
import { SortAscendingIcon, SortDescendingIcon, ChevronDownIcon } from '@heroicons/react/solid'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import CustomButton from '../CustomButton'

const messages = defineMessages({
  searchPlaceholder: {
    defaultMessage: 'Search...',
    id: 'common.input.search.placeholder',
  },
})

interface Props {
  handleSearch: any
  handleSortByChange: any
  handleSortOrderToggle: any
  sortBy: string
  sortingTypes: {
    content: string
    id: string
    labelStart: string
  }[]
  sortOrder: boolean
  withSorting?: boolean
}

const defaultProps = {
  withSorting: false,
}

function SearchArea({
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  sortBy,
  sortingTypes,
  sortOrder,
  withSorting,
}: Props) {
  const intl = useIntl()

  return (
    <div className="flex flex-start">
      <Input
        fluid
        className="!flex-1 !mr-4"
        icon="search"
        placeholder={intl.formatMessage(messages.searchPlaceholder)}
        onChange={(e): void => handleSearch(e.target.value)}
      >
        <input />
      </Input>

      {withSorting && (
        <>
          <CustomButton
            className={'!p-[0.65rem] bg-white w-11 h-11 mr-1'}
            disabled={false}
            onClick={handleSortOrderToggle}
          >
            {sortOrder ? <SortDescendingIcon /> : <SortAscendingIcon />}
          </CustomButton>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="flex flex-row pl-5 text-left bg-white border border-solid rounded-md w-44 h-11 border-grey-80">
              <div className="flex-1 h-full py-2.5">{sortingTypes.find((type) => type.id === sortBy).content}</div>
              <ChevronDownIcon className="w-5 mr-2" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col px-2 bg-white border border-solid rounded-md border-grey-80">
              {sortingTypes.map(({ content, id }, index): any => (
                <>
                  <DropdownMenu.Item
                    className="[all:_unset] w-50 hover:bg-blue-20 bg-white align-middle !px-6 !py-1 !rounded-md !my-1"
                    key={content}
                    onClick={() => handleSortByChange(id)}
                  >
                    <span className={clsx(sortBy === id && 'font-bold', 'text-lg')}>{content}</span>
                  </DropdownMenu.Item>
                  <div
                    className={clsx(
                      'h-[0.075rem] bg-grey-80 opacity-40',
                      sortingTypes.length - 1 === index && 'hidden'
                    )}
                  />
                </>
              ))}

              <DropdownMenu.Arrow className="bg-white" />
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </>
      )}
    </div>
  )
}

SearchArea.defaultProps = defaultProps

export default SearchArea
