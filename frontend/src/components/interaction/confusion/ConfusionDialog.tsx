import React, { useState, useRef } from 'react'
import { Button } from 'semantic-ui-react'

interface Props {
  handleChange: any
  labels: any
  icons?: any
  title: React.ReactNode
  value?: number
}

const defaultProps = {
  title: undefined,
  icons: undefined,
  value: undefined,
}

const ConfusionButton = ({ children, value, changeValue, onClick, disabled, withIcon }) => {
  return (
    <Button
      basic
      className="flex-1 !mr-0"
      color={value === changeValue ? 'blue' : undefined}
      disabled={disabled}
      icon={withIcon}
      labelPosition={withIcon ? 'left' : undefined}
      size="small"
      onClick={() => onClick(changeValue)}
    >
      {children}
    </Button>
  )
}

function ConfusionDialog({ title, value, handleChange, labels, icons }: Props): React.ReactElement {
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)
  const confusionButtonTimeout = useRef<any>()

  const handleClick = (val) => {
    handleChange(val)
    setConfusionEnabled(false)
    if (confusionButtonTimeout.current) {
      clearTimeout(confusionButtonTimeout.current)
    }
    confusionButtonTimeout.current = setTimeout(setConfusionEnabled, 60000, true)
  }
  return (
    <div>
      <div className="flex flex-col gap-1 md:text-left">
        {title && <h2 className="!mb-0 !text-base md:w-24">{title}</h2>}
        <div className="flex flex-row gap-2">
          <ConfusionButton
            changeValue={-1}
            disabled={!isConfusionEnabled}
            value={value}
            withIcon={!!icons?.min}
            onClick={handleClick}
          >
            {icons?.min && <i className="icon">{icons.min}</i>}
            {labels.min}
          </ConfusionButton>
          <ConfusionButton
            changeValue={0}
            disabled={!isConfusionEnabled}
            value={value}
            withIcon={!!icons?.mid}
            onClick={handleClick}
          >
            {icons?.mid && <i className="icon">{icons.mid}</i>}
            {labels.mid}
          </ConfusionButton>
          <ConfusionButton
            changeValue={1}
            disabled={!isConfusionEnabled}
            value={value}
            withIcon={!!icons?.max}
            onClick={handleClick}
          >
            {icons?.max && <i className="icon">{icons.max}</i>}
            {labels.max}
          </ConfusionButton>
        </div>
      </div>
    </div>
  )
}

ConfusionDialog.defaultProps = defaultProps

export default ConfusionDialog
