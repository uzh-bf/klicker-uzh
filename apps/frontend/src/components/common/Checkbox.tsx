import React from 'react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import clsx from 'clsx'

interface Props {
  children: React.ReactNode
  checked: boolean
  onCheck: any
  id: string
  className?: string
  activeVersion?: number
}

const defaultProps = {
  className: '',
  activeVersion: 0,
}

function Checkbox({ children, checked, onCheck, id, className, activeVersion }: Props): React.ReactElement {
  return (
    <RadixCheckbox.Root
      defaultChecked
      checked={checked}
      className={clsx(
        'flex justify-center w-5 h-5 p-0 bg-white border border-solid rounded-md border-grey-80 align-center',
        checked && 'border-black',
        className
      )}
      id={`check-${id}`}
      onCheckedChange={() => onCheck({ version: activeVersion })}
    >
      <RadixCheckbox.CheckboxIndicator>{children}</RadixCheckbox.CheckboxIndicator>
    </RadixCheckbox.Root>
  )
}

Checkbox.defaultProps = defaultProps

export default Checkbox
