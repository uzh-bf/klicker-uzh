import React from 'react'
import clsx from 'clsx'
import * as Switch from '@radix-ui/react-switch'

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
      className={clsx('relative w-12 h-[1.6rem] bg-black rounded-full border-0 unset', classNameRoot)}
      onCheckedChange={onCheckedChange}
    >
      <Switch.Thumb className={clsx('block w-5 h-5 bg-white rounded-full', classNameThumb)} />
    </Switch.Root>
  )
}

CustomSwitch.defaultProps = defaultProps

export default CustomSwitch
