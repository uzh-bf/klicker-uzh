import React, { useState } from 'react'
import { Button } from 'semantic-ui-react'

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
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)

  const ConfusionButton = ({ children, onChangeValue }) => {
    let confusionButtonTimer

    return (
      <Button
        className="min-w-[32%] md:min-w-[0%]"
        color={value === onChangeValue ? 'blue' : undefined}
        disabled={!isConfusionEnabled}
        onClick={(): void => {
          handleChange(onChangeValue)
          setConfusionEnabled(false)
          clearTimeout(confusionButtonTimer)
          confusionButtonTimer = setTimeout(setConfusionEnabled, 60000, true)
        }}
      >
        {children}
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
