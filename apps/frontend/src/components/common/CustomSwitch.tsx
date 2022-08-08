import * as Switch from '@radix-ui/react-switch'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface SwitchProps {
  checked: boolean
  classNameRoot?: string
  classNameThumb?: string
  onCheckedChange: () => void
}

const defaultProps = {
  classNameRoot: '',
  classNameThumb: '',
}

function CustomSwitch({ checked, classNameRoot, classNameThumb, onCheckedChange }: SwitchProps): React.ReactElement {
  return (
    <Switch.Root
      checked={checked}
      className={twMerge('relative w-12 h-[1.6rem] bg-black rounded-full border-0 unset', classNameRoot)}
      onCheckedChange={onCheckedChange}
    >
      <Switch.Thumb className={twMerge('block w-5 h-5 bg-white rounded-full', classNameThumb)} />
    </Switch.Root>
  )
}

CustomSwitch.defaultProps = defaultProps

export default CustomSwitch
