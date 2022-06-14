import React, { useState, useEffect } from 'react'
import { defineMessages, useIntl } from 'react-intl'
import { Input } from 'semantic-ui-react'
import { SortAscendingIcon, SortDescendingIcon, ChevronDownIcon } from '@heroicons/react/solid'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { CheckIcon, MinusSmIcon } from '@heroicons/react/outline'

import CustomButton from '../CustomButton'
import CustomCheckbox from '../CustomCheckbox'

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
  handleSetItemsChecked: any
  handleResetItemsChecked: any
  itemsChecked?: string[]
  questions?: any[]
}

const defaultProps = {
  withSorting: false,
  itemsChecked: [],
  questions: [],
}

function SearchArea({
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  sortBy,
  sortingTypes,
  sortOrder,
  withSorting,
  handleSetItemsChecked,
  handleResetItemsChecked,
  itemsChecked,
  questions,
}: Props) {
  const intl = useIntl()
  const [allItemsChecked, setAllItemsChecked] = useState(false)
  const itemCount = itemsChecked.length

  const getCheckboxState = (allItems, numOfItems) => {
    if (allItems || numOfItems === questions.length) {
      return true
    }
    if (!allItems && numOfItems > 0) {
      return 'indeterminate'
    }
    return false
  }

  const onSetAllItemsChecked = (): void => {
    // if all items have been checked, reset selection
    if (allItemsChecked) {
      handleResetItemsChecked()
    } else {
      // otherwise, select all items
      handleSetItemsChecked(questions)
    }
  }

  useEffect(() => {
    if (itemCount === questions.length) {
      setAllItemsChecked(true)
    } else {
      setAllItemsChecked(false)
    }
  }, [itemCount, questions.length])

  return (
    <div className="flex flex-start">
      <CustomCheckbox
        checked={getCheckboxState(allItemsChecked, itemCount)}
        className="my-auto mr-2"
        id={'checkedCounter'}
        onCheck={(): void => onSetAllItemsChecked()}
      >
        {getCheckboxState(allItemsChecked, itemCount) === true ? <CheckIcon /> : null}
        {getCheckboxState(allItemsChecked, itemCount) === 'indeterminate' ? <MinusSmIcon /> : null}
      </CustomCheckbox>
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
            <DropdownMenu.Trigger className="flex flex-row pl-5 text-left bg-white border border-solid rounded-md w-44 h-11 border-grey-80 hover:cursor-pointer">
              <div className="flex-1 h-full py-2.5">{sortingTypes.find((type) => type.id === sortBy).content}</div>
              <ChevronDownIcon className="w-5 mr-2" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col px-2 bg-white border border-solid rounded-md border-grey-80">
              {sortingTypes.map(({ content, id }, index): any => (
                <>
                  <DropdownMenu.Item
                    className="[all:_unset] w-50 hover:bg-blue-20 bg-white align-middle !px-6 !py-1 !rounded-md !my-1 hover:cursor-pointer"
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
