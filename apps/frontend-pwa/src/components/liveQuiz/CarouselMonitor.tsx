import { CarouselApi } from '@uzh-bf/design-system'
import { FormikErrors } from 'formik'
import { useEffect } from 'react'

function CarouselMonitor({
  api,
  avatars,
  setFieldValue,
}: {
  api: CarouselApi | undefined
  avatars: string[]
  setFieldValue: (
    field: string,
    value: string
  ) => Promise<void | FormikErrors<{
    pseudonym: string
    avatar: string
  }>>
}) {
  useEffect(() => {
    if (!api) {
      return
    }

    setFieldValue('avatar', avatars[api.selectedScrollSnap() ?? 0])
    api.on('select', () => {
      setFieldValue('avatar', avatars[api.selectedScrollSnap() ?? 0])
    })
  }, [api, avatars, setFieldValue])

  return null
}

export default CarouselMonitor
