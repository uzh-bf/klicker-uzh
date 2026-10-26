import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

// The design system's ButtonProps is a union discriminated on `asChild`, whose
// `asChild: true` branch types `ref` as `never`. This wrapper always renders a
// real button and supplies its own forwarded ref, so both keys are dropped to
// leave the shared base props.
type ForwardRefButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'ref' | 'asChild'
> & {
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
