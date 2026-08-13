import { Dispatch, SetStateAction, useEffect } from 'react'

interface CreationFormValidatorProps {
  isValid: boolean
  activeStep: number
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
}

function CreationFormValidator({
  isValid,
  activeStep,
  setStepValidity,
}: CreationFormValidatorProps) {
  useEffect(() => {
    setStepValidity((prevValidity) => {
      const newValidity = [...prevValidity]
      newValidity[activeStep] = isValid
      return newValidity
    })
  }, [activeStep, isValid, setStepValidity])

  return null
}

export default CreationFormValidator
