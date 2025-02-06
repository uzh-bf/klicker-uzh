export async function getSlideID(maxRetries = 3): Promise<number> {
  let retryCount = 0

  const tryGetSlideID = async (): Promise<number> => {
    try {
      // Validate Office context
      if (!Office?.context?.document) {
        throw new Error('Office context is not available')
      }

      if (!Office.context.document.getSelectedDataAsync) {
        throw new Error(
          'getSelectedDataAsync is not supported by this host application'
        )
      }

      return new Promise((resolve, reject) => {
        Office.context.document.getSelectedDataAsync(
          Office.CoercionType.SlideRange,
          (
            asyncResult: Office.AsyncResult<{
              slides: { id: number; title: string; index: number }[]
            }>
          ) => {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
              console.log('Slide data:', asyncResult.value)

              if (!asyncResult.value?.slides?.length) {
                reject(
                  new Error('No slides selected. Please select a slide first.')
                )
                return
              }

              const slideId = asyncResult.value.slides[0]?.id
              if (typeof slideId !== 'number') {
                reject(new Error('Invalid slide ID received'))
                return
              }

              resolve(slideId)
            } else {
              console.error('AsyncResult error:', asyncResult.error)
              reject(
                new Error(
                  asyncResult.error?.message || 'Failed to read slide ID'
                )
              )
            }
          }
        )
      })
    } catch (error) {
      console.error('Error in tryGetSlideID:', error)
      throw error
    }
  }

  while (retryCount < maxRetries) {
    try {
      return await tryGetSlideID()
    } catch (error) {
      retryCount++
      console.log(`Attempt ${retryCount} of ${maxRetries} failed`)

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to get slide ID after ${maxRetries} attempts: ${error}`
        )
      }

      // Wait for a short time before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000))
      )
    }
  }

  throw new Error('Failed to get slide ID') // This should never be reached due to the throw in the retry loop
}
