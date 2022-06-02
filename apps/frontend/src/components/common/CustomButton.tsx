import clsx from 'clsx'
import React from 'react'

interface Props {
  active?: boolean
  activeStyle?: string
  className?: string
  onClick: () => void
  children: React.ReactNode
}

const defaultProps = {
  active: false,
  activeStyle: '',
  className: '',
}

function CustomButton({ active, activeStyle, className, onClick, children }: Props): React.ReactElement {
  return (
    <button
      className={clsx(className, 'p-2 border border-solid rounded-md border-grey-80 align-center hover:cursor-pointer')}
      type="button"
      onClick={onClick}
    >
      <div className={active ? activeStyle : ''}>{children}</div>
    </button>
  )
}

CustomButton.defaultProps = defaultProps
export default CustomButton
