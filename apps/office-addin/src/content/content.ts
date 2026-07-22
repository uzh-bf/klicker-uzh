import { isValidEvaluationUrl } from './evaluation-url'

type MessageType = 'success' | 'error' | 'info' | 'warning'
type ValidationState = 'valid' | 'invalid' | 'empty'

interface AppElements {
  appContainer: HTMLDivElement
  changeUrlButton: HTMLButtonElement
  contentIframe: HTMLIFrameElement
  embedButton: HTMLButtonElement
  iframeContainer: HTMLDivElement
  messageBox: HTMLDivElement
  messageText: HTMLSpanElement
  urlInput: HTMLInputElement
  urlValidationMessage: HTMLDivElement
}

const SETTINGS_KEY = 'embeddedUrl'
const LEGACY_SETTINGS_PREFIX = 'selectedURL'

let elements: AppElements
let messageTimeout: ReturnType<typeof setTimeout> | undefined
let hideMessageTimeout: ReturnType<typeof setTimeout> | undefined

Office.onReady((info) => {
  const initialize = () => void initializeOfficeAddin(info)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true })
  } else {
    initialize()
  }
})

async function initializeOfficeAddin(info: {
  host: Office.HostType
  platform: Office.PlatformType
}): Promise<void> {
  if (info.host !== Office.HostType.PowerPoint) {
    console.error('This add-in is designed to run only in PowerPoint.')
    document.body.textContent = 'This add-in only works in PowerPoint.'
    return
  }

  elements = {
    appContainer: getElement('app-container'),
    changeUrlButton: getElement('change-embedded-url-button'),
    contentIframe: getElement('content-iframe'),
    embedButton: getElement('embed-button'),
    iframeContainer: getElement('iframe-container'),
    messageBox: getElement('message-box'),
    messageText: getElement('message-text'),
    urlInput: getElement('url-input'),
    urlValidationMessage: getElement('url-validation-message'),
  }

  elements.urlInput.disabled = true
  await loadInitialState()
  elements.urlInput.disabled = false

  elements.embedButton.addEventListener('click', () => void handleEmbedClick())
  elements.changeUrlButton.addEventListener(
    'click',
    () => void handleChangeUrlClick()
  )
  elements.urlInput.addEventListener('input', handleUrlInput)
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Missing required element: #${id}`)
  }
  return element as T
}

async function loadInitialState(): Promise<void> {
  const savedUrl = getStringSetting(SETTINGS_KEY)
  if (savedUrl && isValidEvaluationUrl(savedUrl)) {
    displayIframe(savedUrl)
    return
  }

  const migratedUrl = await migrateLegacySetting()
  if (migratedUrl) {
    displayIframe(migratedUrl)
    return
  }

  showInitialView()
}

function getStringSetting(key: string): string | undefined {
  const value = Office.context.document.settings.get(key)
  return typeof value === 'string' ? value : undefined
}

async function migrateLegacySetting(): Promise<string | undefined> {
  try {
    const slideId = await getSlideId()
    const legacyKey = `${LEGACY_SETTINGS_PREFIX}${slideId}`
    const legacyUrl = getStringSetting(legacyKey)

    if (!legacyUrl || !isValidEvaluationUrl(legacyUrl)) {
      return undefined
    }

    Office.context.document.settings.set(SETTINGS_KEY, legacyUrl)
    if (!(await saveSettings())) {
      Office.context.document.settings.remove(SETTINGS_KEY)
      showMessage(
        'Failed to update settings format. Please embed the URL again.',
        'error'
      )
      return undefined
    }

    Office.context.document.settings.remove(legacyKey)
    const removedLegacySetting = await saveSettings()
    showMessage(
      removedLegacySetting
        ? 'Settings format updated successfully.'
        : 'The URL was migrated, but its old setting could not be removed.',
      removedLegacySetting ? 'info' : 'warning',
      4000
    )

    return legacyUrl
  } catch (error) {
    console.warn('Could not migrate the legacy slide setting:', error)
    return undefined
  }
}

async function getSlideId(maxAttempts = 3): Promise<number> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getSelectedSlideId()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await delay(Math.min(1000 * 2 ** (attempt - 1), 5000))
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : lastError
  throw new Error(
    `Failed to get slide ID after ${maxAttempts} attempts: ${detail}`
  )
}

function getSelectedSlideId(): Promise<number> {
  return new Promise((resolve, reject) => {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.SlideRange,
      {
        valueFormat: Office.ValueFormat.Unformatted,
        filterType: Office.FilterType.All,
      },
      (result: Office.AsyncResult<Office.SlideRange>) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          reject(new Error(result.error?.message || 'Failed to read slide ID'))
          return
        }

        const slideId = result.value?.slides?.[0]?.id
        if (typeof slideId !== 'number') {
          reject(new Error('No selected slide is available'))
          return
        }

        resolve(slideId)
      }
    )
  })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function handleUrlInput(): void {
  const url = elements.urlInput.value.trim()
  setValidationState(
    !url ? 'empty' : isValidEvaluationUrl(url) ? 'valid' : 'invalid'
  )
}

function setValidationState(state: ValidationState): void {
  elements.urlInput.dataset.validation = state
  elements.urlValidationMessage.hidden = state === 'empty'

  switch (state) {
    case 'valid':
      showValidationMessage('✓ Valid KlickerUZH evaluation URL', 'success')
      elements.embedButton.disabled = false
      break
    case 'invalid':
      showValidationMessage(
        'Please enter a valid KlickerUZH evaluation URL',
        'error'
      )
      elements.embedButton.disabled = true
      break
    case 'empty':
      elements.urlValidationMessage.textContent = ''
      elements.embedButton.disabled = true
      break
  }
}

function showValidationMessage(
  message: string,
  type: 'success' | 'error'
): void {
  elements.urlValidationMessage.textContent = message
  elements.urlValidationMessage.dataset.type = type
  elements.urlValidationMessage.hidden = false
}

async function handleEmbedClick(): Promise<void> {
  const url = elements.urlInput.value.trim()
  if (!isValidEvaluationUrl(url)) {
    showMessage(
      'Paste a valid KlickerUZH quiz evaluation link, including its HMAC.',
      'error'
    )
    return
  }

  Office.context.document.settings.set(SETTINGS_KEY, url)
  if (!(await saveSettings())) {
    showMessage('Could not save the URL. Please try again.', 'error')
    return
  }

  displayIframe(url)
  showMessage('URL embedded successfully.', 'success')
}

function saveSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    Office.context.document.settings.saveAsync((result) => {
      resolve(result.status === Office.AsyncResultStatus.Succeeded)
    })
  })
}

function displayIframe(url: string): void {
  elements.contentIframe.src = url
  elements.appContainer.classList.add('fullscreen-mode')
  elements.iframeContainer.hidden = false
  elements.changeUrlButton.hidden = false
}

async function handleChangeUrlClick(): Promise<void> {
  const savedUrl = getStringSetting(SETTINGS_KEY)
  elements.changeUrlButton.disabled = true
  Office.context.document.settings.remove(SETTINGS_KEY)

  if (!(await saveSettings())) {
    if (savedUrl) {
      Office.context.document.settings.set(SETTINGS_KEY, savedUrl)
    }
    elements.changeUrlButton.disabled = false
    showMessage('Could not clear the saved URL.', 'warning')
    return
  }

  showInitialView()
  elements.changeUrlButton.disabled = false
}

function showInitialView(): void {
  elements.appContainer.classList.remove('fullscreen-mode')
  elements.iframeContainer.hidden = true
  elements.changeUrlButton.hidden = true
  elements.contentIframe.src = 'about:blank'
  elements.urlInput.value = ''
  setValidationState('empty')
}

function showMessage(
  message: string,
  type: MessageType,
  duration = 3000
): void {
  clearTimeout(messageTimeout)
  clearTimeout(hideMessageTimeout)

  elements.messageText.textContent = message
  elements.messageBox.dataset.type = type
  elements.messageBox.hidden = false

  setTimeout(() => elements.messageBox.classList.add('is-visible'), 10)
  messageTimeout = setTimeout(() => {
    elements.messageBox.classList.remove('is-visible')
    hideMessageTimeout = setTimeout(() => {
      elements.messageBox.hidden = true
      elements.messageText.textContent = ''
    }, 500)
  }, duration)
}
