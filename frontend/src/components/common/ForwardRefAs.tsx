import React, { Ref } from 'react'

interface Props {
  forwardedRef: Ref<any>
}

export default (As: any) =>
  ({ forwardedRef, ...props }: Props): React.ReactElement =>
    <As ref={forwardedRef} {...props} />
