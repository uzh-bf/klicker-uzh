import clsx from 'clsx'
import React from 'react'

interface Props {
  active?: boolean
  activeStyle?: string
  className?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

const defaultProps = {
  active: false,
  activeStyle: '',
  className: '',
  disabled: false,
}

function CustomButton({ active, activeStyle, className, disabled, onClick, children }: Props): React.ReactElement {
  return (
    <button
      className={clsx(
        className,
        'p-2 border border-solid rounded-md border-grey-80 align-center hover:cursor-pointer',
        disabled && '!cursor-not-allowed'
      )}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className={active ? activeStyle : ''}>{children}</div>
    </button>
  )
}

CustomButton.defaultProps = defaultProps
export default CustomButton
