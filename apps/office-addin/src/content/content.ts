/**
 * @fileoverview Main script for the KlickerUZH PowerPoint Add-in content pane.
 * Handles initialization, UI interactions, embedding evaluation URLs,
 * and persisting the embedded URL across sessions using Office document settings.
 */

// --- TypeScript Interfaces ---

interface SlideData {
  id: number
  title?: string
  index: number
}

// Removed unused interfaces - keeping only what's actually used

type MessageType = 'success' | 'error' | 'info' | 'warning'

// --- DOM Element References ---
// These will be initialized in initializeApp() when DOM is ready
let iframeContainer: HTMLDivElement | null = null
let urlInput: HTMLInputElement | null = null
let contentIframe: HTMLIFrameElement | null = null
let messageBox: HTMLDivElement | null = null
let messageText: HTMLSpanElement | null = null
let embedButton: HTMLButtonElement | null = null
let changeEmbeddedUrlButton: HTMLButtonElement | null = null
let appContainer: HTMLDivElement | null = null
let urlValidationMessage: HTMLDivElement | null = null

// --- Constants ---
/**
 * The key used to store and retrieve the embedded evaluation URL
 * within the Office document's settings.
 */
const SETTINGS_KEY = 'embeddedUrl'

/**
 * Office.onReady() callback ensures the Office JavaScript API is loaded and ready.
 * It verifies the host application is PowerPoint before initializing the add-in logic.
 * Displays an error message if the host is not PowerPoint.
 */
Office.onReady((info) => {
  // Ensure DOM is fully loaded before accessing elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      initializeOfficeAddin(info)
    )
  } else {
    initializeOfficeAddin(info)
  }
})

/**
 * Initializes the Office add-in after ensuring both Office.js and DOM are ready.
 * @param info - Office host information from Office.onReady callback
 */
function initializeOfficeAddin(info: {
  host: Office.HostType
  platform: Office.PlatformType
}): void {
  // Check if the host application is PowerPoint
  if (info.host === Office.HostType.PowerPoint) {
    initializeApp() // Proceed with add-in initialization
  } else {
    console.error('This add-in is designed to run only in PowerPoint.')
    document.body.textContent = 'This add-in only works in PowerPoint.'
  }
}

// --- Initialization ---
/**
 * Initializes the core functionality of the add-in.
 * Sets up event listeners for the main buttons and loads the initial state
 * based on any previously saved URL in the document settings.
 */
function initializeApp(): void {
  // Get DOM element references when DOM is ready
  iframeContainer = document.getElementById(
    'iframe-container'
  ) as HTMLDivElement | null
  urlInput = document.getElementById('url-input') as HTMLInputElement | null
  contentIframe = document.getElementById(
    'content-iframe'
  ) as HTMLIFrameElement | null
  messageBox = document.getElementById('message-box') as HTMLDivElement | null
  messageText = document.getElementById(
    'message-text'
  ) as HTMLSpanElement | null
  embedButton = document.getElementById(
    'embed-button'
  ) as HTMLButtonElement | null
  changeEmbeddedUrlButton = document.getElementById(
    'change-embedded-url-button'
  ) as HTMLButtonElement | null
  appContainer = document.getElementById(
    'app-container'
  ) as HTMLDivElement | null
  urlValidationMessage = document.getElementById(
    'url-validation-message'
  ) as HTMLDivElement | null

  // Attach event listeners to buttons
  if (embedButton) {
    embedButton.addEventListener('click', handleEmbedClick) // Handle embedding action
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.addEventListener('click', showInitialView) // Handle changing the URL
  }

  // Add input validation event listeners
  if (urlInput) {
    urlInput.addEventListener('input', handleUrlInput) // Real-time validation
    urlInput.addEventListener('blur', handleUrlBlur) // Validation on focus loss
    urlInput.addEventListener('paste', handleUrlPaste) // Handle paste events
  }

  // Load the initial state (either show saved iframe or initial view)
  loadInitialState()
}

/**
 * Loads the initial state of the add-in.
 * Attempts to load a previously saved URL from the document settings using the new key.
 * If not found, attempts to migrate legacy settings ('selectedURL' + slideID).
 * If a URL is found (either new or migrated), it displays the iframe.
 * Otherwise, it shows the initial view for entering a URL.
 */
async function loadInitialState(): Promise<void> {
  const savedUrl = Office.context.document.settings.get(SETTINGS_KEY) as
    | string
    | undefined

  if (savedUrl && isValidUrl(savedUrl)) {
    // Standard case: URL found with new key
    displayIframe(savedUrl)
  } else {
    // No valid URL with new key, attempt legacy migration
    try {
      const slideID = await getSlideID() // Get current slide ID (can throw)
      const legacyKey = 'selectedURL' + slideID
      const legacyUrl = Office.context.document.settings.get(legacyKey) as
        | string
        | undefined

      if (legacyUrl && isValidUrl(legacyUrl)) {
        // Found a valid legacy URL
        // Save the legacy URL under the new key
        saveUrlToSettings(legacyUrl, (saveSuccess) => {
          if (saveSuccess) {
            // Now remove the old legacy key
            Office.context.document.settings.remove(legacyKey)
            Office.context.document.settings.saveAsync((removeResult) => {
              if (removeResult.status === Office.AsyncResultStatus.Succeeded) {
                showMessage(
                  'Settings format updated successfully.',
                  'info',
                  4000
                ) // Show longer message
              } else {
                showMessage(
                  'Could not remove old setting, but migration succeeded.',
                  'warning'
                )
              }
              // Display the migrated content regardless of removal status
              displayIframe(legacyUrl)
            })
          } else {
            // Failed to save the migrated URL under the new key - critical step failed
            showMessage(
              'Failed to update settings format. Please try embedding again.',
              'error'
            )
            showInitialView() // Show initial view as migration failed
          }
        })
      } else {
        // No legacy URL found for this slide, or it's invalid
        showInitialView() // Show initial view, no migration needed/possible
      }
    } catch {
      // Error during migration attempt (e.g., getSlideID failed or other unexpected error)
      // Do not show error to user, just proceed to initial view as a fallback
      showInitialView()
    }
  }
}

/**
 * Asynchronously retrieves the ID of the currently selected slide in PowerPoint.
 * Implements retry logic with exponential backoff for improved reliability.
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns A promise that resolves with the slide ID.
 * @throws Error if the slide ID cannot be retrieved after all retries.
 */
async function getSlideID(maxRetries = 3): Promise<number> {
  let retryCount = 0

  const tryGetSlideID = async (): Promise<number> => {
    try {
      // Pre-checks before calling Office API
      if (!Office?.context?.document) {
        throw new Error('Office context is not available')
      }
      if (!Office.context.document.getSelectedDataAsync) {
        throw new Error(
          'getSelectedDataAsync is not supported by this host application'
        )
      }

      return new Promise<number>((resolve, reject) => {
        Office.context.document.getSelectedDataAsync(
          Office.CoercionType.SlideRange,
          {
            valueFormat: Office.ValueFormat.Unformatted,
            filterType: Office.FilterType.All, // Ensure we get slide details
          },
          (asyncResult: Office.AsyncResult<{ slides: SlideData[] }>) => {
            // Handle the API callback
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
              if (!asyncResult.value?.slides?.length) {
                reject(
                  new Error(
                    'No slides selected or slide data unavailable. Please select a slide.'
                  )
                )
                return
              }
              const id = asyncResult.value.slides[0]?.id
              if (typeof id !== 'number') {
                reject(new Error(`Invalid slide ID received: ${id}`))
                return
              }
              resolve(id) // Resolve the promise with the valid slide ID
            } else {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to get slide ID after ${maxRetries} attempts: ${errorMessage}`
        )
      }

      // Wait for a short time before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error('Failed to get slide ID') // This should never be reached due to the throw in the retry loop
}

// --- Input Validation ---

/**
 * Real-time validation states for the URL input
 */
type ValidationState = 'valid' | 'invalid' | 'empty' | 'pending'

// Validation timeout for debouncing
let validationTimeout: ReturnType<typeof setTimeout>

/**
 * Handles real-time input validation as the user types
 */
function handleUrlInput(): void {
  if (!urlInput) return

  const url = urlInput.value.trim()

  if (url === '') {
    setValidationState('empty')
    return
  }

  // Debounce validation to avoid excessive checks while typing
  clearTimeout(validationTimeout)
  setValidationState('pending')

  validationTimeout = setTimeout(() => {
    validateUrlInput(url)
  }, 300) // 300ms debounce
}

/**
 * Handles validation when the input loses focus
 */
function handleUrlBlur(): void {
  if (!urlInput) return

  const url = urlInput.value.trim()
  if (url !== '') {
    validateUrlInput(url)
  }
}

/**
 * Handles paste events with immediate validation
 */
function handleUrlPaste(): void {
  if (!urlInput) return

  // Use setTimeout to allow the paste to complete
  setTimeout(() => {
    if (!urlInput) return
    const url = urlInput.value.trim()
    if (url !== '') {
      validateUrlInput(url)
    }
  }, 10)
}

/**
 * Validates the URL input and updates the UI accordingly
 * @param url - The URL to validate
 */
function validateUrlInput(url: string): void {
  if (isValidUrl(url)) {
    setValidationState('valid')
  } else {
    setValidationState('invalid')
  }
}

/**
 * Sets the visual validation state of the input field
 * @param state - The validation state to apply
 */
function setValidationState(state: ValidationState): void {
  if (!urlInput || !urlValidationMessage) return

  urlInput.dataset.validation = state
  urlValidationMessage.hidden = state === 'empty'

  switch (state) {
    case 'valid':
      showValidationMessage('✓ Valid KlickerUZH evaluation URL', 'success')
      updateEmbedButton(true)
      break

    case 'invalid':
      showValidationMessage(
        'Please enter a valid KlickerUZH evaluation URL',
        'error'
      )
      updateEmbedButton(false)
      break

    case 'pending':
      showValidationMessage('Validating...', 'pending')
      updateEmbedButton(false)
      break

    case 'empty':
      urlValidationMessage.textContent = ''
      updateEmbedButton(false)
      break
  }
}

/**
 * Shows a validation message below the input field
 * @param message - The message to display
 * @param type - The type of message (success, error, pending)
 */
function showValidationMessage(
  message: string,
  type: 'success' | 'error' | 'pending'
): void {
  if (!urlValidationMessage) return

  urlValidationMessage.textContent = message
  urlValidationMessage.dataset.type = type
  urlValidationMessage.hidden = false
}

/**
 * Updates the embed button state based on validation
 * @param isValid - Whether the input is valid
 */
function updateEmbedButton(isValid: boolean): void {
  if (!embedButton) return

  embedButton.disabled = !isValid
}

// --- Event Handlers ---
/**
 * Handles the click event of the 'Embed' button.
 * Validates the entered URL, saves it to settings if valid, displays the iframe,
 * and provides user feedback via messages.
 */
function handleEmbedClick(): void {
  if (!urlInput) {
    console.error('URL input element not found')
    return
  }

  const url = urlInput.value.trim() // Get and trim the URL from the input

  if (isValidUrl(url)) {
    // If the URL is valid
    saveUrlToSettings(url, (success) => {
      // Attempt to save the URL
      if (success) {
        // If save is successful
        displayIframe(url) // Display the iframe
        showMessage('URL embedded successfully.', 'success') // Show success message
      } else {
        // If save fails
        showMessage('Error saving URL. Please try again.', 'error') // Show error message
      }
    })
  } else {
    // If the URL is invalid
    showMessage(
      'Please enter a valid KlickerUZH Evaluation URL (e.g., https://manage.klicker.uzh.ch/quizzes/.../evaluation?hmac=... or https://manage.klicker.uzh.ch/sessions/.../evaluation?hmac=...).',
      'error'
    )
  }
}

// --- Core Logic ---
/**
 * Saves the provided URL to the Office document settings using the defined SETTINGS_KEY.
 * Executes an asynchronous save operation required by the Office API.
 * @param url - The URL string to save.
 * @param callback - An optional callback function executed after the save attempt.
 *                   It receives `true` if the save succeeded, `false` otherwise.
 */
function saveUrlToSettings(
  url: string,
  callback?: (success: boolean) => void
): void {
  // Set the setting value in memory
  Office.context.document.settings.set(SETTINGS_KEY, url)

  // Persist the change asynchronously
  Office.context.document.settings.saveAsync((asyncResult) => {
    if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
      // If persistence succeeded
      if (callback) callback(true) // Notify success via callback
    } else {
      // If persistence failed
      if (callback) callback(false) // Notify failure via callback
    }
  })
}

// --- UI Display Functions ---
/**
 * Switches the view to display the embedded content within the iframe.
 * Hides the initial input area and shows the iframe container.
 * Applies 'fullscreen-mode' CSS class to the main app container.
 * @param url - The URL to load into the iframe.
 */
function displayIframe(url: string): void {
  if (!contentIframe) {
    console.error('Content iframe element not found')
    return
  }

  contentIframe.src = url // Set the source of the iframe

  // Add the CSS class to trigger fullscreen styles defined in content.html
  if (appContainer) {
    appContainer.classList.add('fullscreen-mode')
  }

  // Show iframe container and change button, hide initial input area
  if (iframeContainer) {
    iframeContainer.hidden = false
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.hidden = false
  }
}

/**
 * Switches the view back to the initial state where the user can enter a URL.
 * Hides the iframe container and shows the input area.
 * Removes the 'fullscreen-mode' CSS class from the main app container.
 * Clears the currently saved URL from settings and the input field.
 */
function showInitialView(): void {
  // Remove fullscreen styles
  if (appContainer) {
    appContainer.classList.remove('fullscreen-mode')
  }

  // Hide iframe container and change button, show initial input area
  if (iframeContainer) {
    iframeContainer.hidden = true
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.hidden = true
  }
  if (contentIframe) {
    contentIframe.src = 'about:blank' // Clear the iframe source
  }
  if (urlInput) {
    urlInput.value = '' // Clear the input field
    setValidationState('empty') // Reset validation state
  }

  // Clear the saved setting asynchronously
  Office.context.document.settings.remove(SETTINGS_KEY)
  Office.context.document.settings.saveAsync((asyncResult) => {
    // Log success or failure of clearing the setting
    if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) {
      console.error(
        'Failed to clear saved URL setting. Error: ' +
          asyncResult.error?.message
      )
      // Optional: Show a message to the user, though it's less critical than save failures.
    }
  })
}

// --- Utility Functions ---
/**
 * Validates if a given string represents a valid Klicker Evaluation URL format.
 * Uses a regular expression to match the specific pattern required.
 * Supports both /sessions/ and /quizzes/ paths for backward compatibility.
 * @param string - The string to validate.
 * @returns Returns `true` if the string matches the Klicker evaluation URL pattern, `false` otherwise.
 */
function isValidUrl(string: string): boolean {
  // Ensure the string is not empty or null
  if (!string) {
    return false
  }

  // Support both /sessions/ and /quizzes/ paths with flexible UUID validation (36 characters)
  // V1 pattern enhanced for better compatibility
  const urlPattern =
    /^https:\/\/manage\.klicker\.uzh\.ch(?:\/[a-z]{2})?\/(sessions|quizzes)\/.{36}\/evaluation\?hmac=.{64}.*$/
  return urlPattern.test(string)
}

/**
 * Displays a temporary message (toast notification) to the user.
 * The message appears at the top-center of the screen and fades out.
 * @param message - The text content of the message.
 * @param type - The type of message, determining its background color.
 * @param duration - How long the message stays visible in milliseconds.
 */
function showMessage(
  message: string,
  type: MessageType,
  duration = 3000
): void {
  if (!messageBox || !messageText) {
    console.error('Message box elements not found in the DOM.', {
      messageBox: !!messageBox,
      messageText: !!messageText,
      domReady: document.readyState,
      messageBoxElement: document.getElementById('message-box'),
      messageTextElement: document.getElementById('message-text'),
    })
    return
  }

  messageText.textContent = message // Set the message text

  messageBox.dataset.type = type
  messageBox.hidden = false

  // Make the message box visible and transition opacity
  messageBox.classList.remove('hidden')
  // Use a slight delay before setting opacity to 1 to ensure transition works
  setTimeout(() => {
    if (messageBox) {
      messageBox.classList.add('is-visible')
    }
  }, 10) // 10ms delay

  // Set a timer to hide the message box after the specified duration
  setTimeout(() => {
    if (messageBox) {
      messageBox.classList.remove('is-visible')
    }
    // Wait for the fade-out transition to complete before hiding the element
    setTimeout(() => {
      if (messageBox) {
        messageBox.hidden = true
      }
      // Clear text and remove specific styling if needed
      if (messageText) {
        messageText.textContent = ''
      }
    }, 500) // Duration should match the CSS transition duration
  }, duration)
}
