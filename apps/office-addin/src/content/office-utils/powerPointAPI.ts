/* global Office*/

declare const Office;

export function getSlideID() {
  return new Promise((resolve, reject) => {
    try {
      Office.context.document.getSelectedDataAsync(
        Office.CoercionType.SlideRange,
        (asyncResult: Office.AsyncResult<{ slides: { id: number; title: string; index: number }[] }>) => {
          resolve(asyncResult.value.slides[0].id);
        },
      );
    } catch {
      reject("an error occurred while reading slide ID");
    }
  });
}
