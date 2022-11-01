import {
  faCheck,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as RadixSelect from '@radix-ui/react-select'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// TODO Attention: scrolling does not work because apparently overflow is set to "hidden" on the body

export interface Item {
  value: string
  disabled?: boolean // disabled React select
  label: string // displayed name
}

// ! CAUTION: triggerStyle has been replaced with className.trigger and itemStyle with className.text (not .item)
// ! the new value attribute allows to overwrite the value of the component - usecase: keeping the state outside of the component
export interface SelectProps {
  items: Item[]
  onChange: (newValue: string) => void
  value?: string
  disabled?: boolean
  size?: 'md' | 'sm'
  className?: {
    trigger?: string
    viewport?: string
    item?: string
    text?: string
  }
}

const defaultProps = {
  disabled: false,
  size: 'md',
  className: {},
}

export function Select({
  items,
  onChange,
  value,
  disabled,
  size,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex">
      <RadixSelect.Root
        defaultValue={items[0].value}
        onValueChange={onChange}
        onOpenChange={(open) => setOpen(open)}
        value={value}
      >
        <RadixSelect.Trigger asChild className={className?.trigger}>
          <Button disabled={disabled}>
            <RadixSelect.Value />
            <RadixSelect.Icon
              className={twMerge('ml-2', size === 'sm' && 'ml-0.5')}
            >
              <FontAwesomeIcon
                icon={open ? faChevronUp : faChevronDown}
                size={size === 'sm' ? 'sm' : '1x'}
              />
            </RadixSelect.Icon>
          </Button>
        </RadixSelect.Trigger>
        <RadixSelect.Content>
          <RadixSelect.ScrollUpButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
            <FontAwesomeIcon
              icon={faChevronUp}
              size={size === 'sm' ? 'sm' : '1x'}
            />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport
            className={twMerge(
              'p-1 bg-white rounded-lg shadow-lg dark:bg-gray-800 z-[9999]',
              className?.viewport
            )}
          >
            <RadixSelect.Group>
              {items.map((item, ix) => (
                <RadixSelect.Item
                  disabled={item.disabled}
                  key={ix}
                  value={item.value}
                  className={twMerge(
                    'relative flex items-center px-8 py-2 rounded-md text-gray-700 dark:text-gray-300 font-medium focus:bg-gray-100 dark:focus:bg-gray-900',
                    'rdx-disabled:opacity-50 focus:outline-none select-none',
                    size === 'sm' && 'px-7',
                    className?.item
                  )}
                >
                  <RadixSelect.ItemText
                    className={twMerge(
                      size === 'sm' && 'text-sm',
                      className?.text
                    )}
                  >
                    {item.label}
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute inline-flex items-center left-2">
                    <FontAwesomeIcon
                      icon={faCheck}
                      size={size === 'sm' ? 'sm' : '1x'}
                    />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Group>
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex items-center justify-center text-gray-700 dark:text-gray-300">
            <FontAwesomeIcon
              icon={faChevronDown}
              size={size === 'sm' ? 'sm' : '1x'}
            />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Root>
    </div>
  )
}

Select.defaultProps = defaultProps
export default Select
