import React, { useState } from 'react'
import Head from 'next/head'
import { Button } from 'semantic-ui-react'

import { createLinks } from '../../../lib/utils/css'

interface Props {
  handleChange: any
  labels?: any
  title: React.ReactNode
  value?: number
}

const defaultProps = {
  labels: undefined,
  title: undefined,
  value: undefined,
}

function ConfusionDialog({ title, value, handleChange, labels }: Props): React.ReactElement {
  const [buttonState, setButtonState] = useState(true)

  const ConfusionButton = (props) => {
    return (
      <Button
        onClick={(): void => {
          handleChange(props.onChangeValue)
          setButtonState(false)
          clearTimeout()
          setTimeout(setButtonState, 60000, true)
        }}
        className="min-w-[32%] md:min-w-[0%]"
        color={value === props.onChangeValue ? 'blue' : undefined}
        disabled={!buttonState}
      >
        {props.children}
      </Button>
    )
  }

  return (
    <div className="mb-10 confusionSlider">
      {title && <div className="m-0 mb-2 text-base">{title}</div>}

      <div className="text-center md:text-left">
        <ConfusionButton onChangeValue={-1}>{labels.min}</ConfusionButton>
        <ConfusionButton onChangeValue={0}>{labels.mid}</ConfusionButton>
        <ConfusionButton onChangeValue={1}>{labels.max}</ConfusionButton>
      </div>
    </div>
  )
}

ConfusionDialog.defaultProps = defaultProps

export default ConfusionDialog
