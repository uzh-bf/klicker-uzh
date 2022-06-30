import clsx from 'clsx'
import React from 'react'

interface Props {
  active?: boolean
  activeStyle?: string
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocus?: () => void
  onSubmit?: () => void
  children: React.ReactNode
}

const defaultProps = {
  active: false,
  activeStyle: '',
  className: '',
  disabled: false,
  type: 'button',
  onClick: undefined,
  onMouseEnter: undefined,
  onMouseLeave: undefined,
  onSubmit: undefined,
  onFocus: undefined,
}

function CustomButton({
  active,
  activeStyle,
  className,
  disabled,
  type,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onSubmit,
  children,
}: Props): React.ReactElement {
  return (
    <button
      className={clsx(
        className,
        'p-2 border border-solid rounded-md border-grey-80 align-center hover:cursor-pointer',
        disabled && '!cursor-not-allowed'
      )}
      disabled={disabled}
      // eslint-disable-next-line react/button-has-type
      type={type || 'button'}
      onClick={onClick}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onSubmit={onSubmit}
    >
      <div className={active ? activeStyle : ''}>{children}</div>
    </button>
  )
}

CustomButton.defaultProps = defaultProps
export default CustomButton
