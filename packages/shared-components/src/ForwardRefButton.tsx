import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ForwardRefButtonProps extends React.ComponentProps<typeof Button> {
  overrideClassName?: string
}

const ForwardRefButton = React.forwardRef<
  HTMLButtonElement,
  ForwardRefButtonProps
>(function ForwardRefButton(props: ForwardRefButtonProps, forwardedRef) {
  return (
    <Button
      ref={forwardedRef}
      type="button"
      id={props.id}
      onClick={props.onClick}
      disabled={props.disabled}
      primary={props.primary}
      destructive={props.destructive}
      active={props.active}
      fluid={props.fluid}
      basic={props.basic}
      loading={props.loading}
      className={{
        ...props.className,
        root: twMerge(props.className?.root, props.overrideClassName),
      }}
      data={props.data}
    >
      {props.children}
    </Button>
  )
})

export default ForwardRefButton
