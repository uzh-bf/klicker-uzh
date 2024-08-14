import { Dispatch, SetStateAction, useEffect } from 'react'

interface CreatinFormValidatorProps {
  isValid: boolean
  activeStep: number
  setStepValidity: Dispatch<SetStateAction<boolean[]>>
}

function CreationFormValidator({
  isValid,
  activeStep,
  setStepValidity,
}: CreatinFormValidatorProps) {
  useEffect(() => {
    setStepValidity((prevValidity) => {
      const newValidity = [...prevValidity]
      newValidity[activeStep] = isValid
      return newValidity
    })
  }, [isValid])

  return null
}

export default CreationFormValidator
