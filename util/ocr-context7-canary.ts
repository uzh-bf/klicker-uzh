import { cookies } from 'next/headers'

// Synthetic OCR fixture; no application imports this module.
export async function readCanaryPreference() {
  const store = await cookies()
  return store.get('ocr_canary_preference')?.value ?? 'unset'
}
