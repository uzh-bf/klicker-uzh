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
// Get references to essential UI elements needed for interactivity.
const iframeContainer = document.getElementById(
  'iframe-container'
) as HTMLDivElement | null
const urlInput = document.getElementById('url-input') as HTMLInputElement | null
const contentIframe = document.getElementById(
  'content-iframe'
) as HTMLIFrameElement | null
const messageBox = document.getElementById(
  'message-box'
) as HTMLDivElement | null
const messageText = document.getElementById(
  'message-text'
) as HTMLSpanElement | null
const embedButton = document.getElementById(
  'embed-button'
) as HTMLButtonElement | null
const changeEmbeddedUrlButton = document.getElementById(
  'change-embedded-url-button'
) as HTMLButtonElement | null
const appContainer = document.getElementById(
  'app-container'
) as HTMLDivElement | null

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
  // Check if the host application is PowerPoint
  if (info.host === Office.HostType.PowerPoint) {
    initializeApp() // Proceed with add-in initialization
  } else {
    // Log error and show message if not running in PowerPoint
    console.error('This add-in is designed to run only in PowerPoint.')
    showMessage('This add-in only works in PowerPoint.', 'error')
  }
})

// --- Initialization ---
/**
 * Initializes the core functionality of the add-in.
 * Sets up event listeners for the main buttons and loads the initial state
 * based on any previously saved URL in the document settings.
 */
function initializeApp(): void {
  console.log('KlickerUZH Add-in initializing...')

  // Attach event listeners to buttons
  if (embedButton) {
    embedButton.addEventListener('click', handleEmbedClick) // Handle embedding action
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.addEventListener('click', showInitialView) // Handle changing the URL
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
  console.log('Loading initial state...')
  const savedUrl = Office.context.document.settings.get(SETTINGS_KEY) as
    | string
    | undefined

  if (savedUrl && isValidUrl(savedUrl)) {
    // Standard case: URL found with new key
    console.log(`Found saved URL with new key '${SETTINGS_KEY}': ${savedUrl}`)
    displayIframe(savedUrl)
  } else {
    // No valid URL with new key, attempt legacy migration
    console.log(
      `No valid URL found with new key '${SETTINGS_KEY}'. Attempting legacy migration...`
    )
    try {
      const slideID = await getSlideID() // Get current slide ID (can throw)
      const legacyKey = 'selectedURL' + slideID
      const legacyUrl = Office.context.document.settings.get(legacyKey) as
        | string
        | undefined

      if (legacyUrl && isValidUrl(legacyUrl)) {
        // Found a valid legacy URL
        console.log(
          `Found valid legacy URL '${legacyUrl}' with key '${legacyKey}'. Migrating...`
        )

        // Save the legacy URL under the new key
        saveUrlToSettings(legacyUrl, (saveSuccess) => {
          if (saveSuccess) {
            console.log(
              `Successfully saved migrated URL under new key '${SETTINGS_KEY}'. Removing legacy key...`
            )
            // Now remove the old legacy key
            Office.context.document.settings.remove(legacyKey)
            Office.context.document.settings.saveAsync((removeResult) => {
              if (removeResult.status === Office.AsyncResultStatus.Succeeded) {
                console.log(
                  `Successfully removed legacy setting key: ${legacyKey}`
                )
                showMessage(
                  'Settings format updated successfully.',
                  'info',
                  4000
                ) // Show longer message
              } else {
                // Log error but proceed, migration is mostly done
                console.error(
                  `Failed to remove legacy setting key ${legacyKey}:`,
                  removeResult.error?.message
                )
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
            console.error(
              `Failed to save migrated URL under new key '${SETTINGS_KEY}'. Aborting migration.`
            )
            showMessage(
              'Failed to update settings format. Please try embedding again.',
              'error'
            )
            showInitialView() // Show initial view as migration failed
          }
        })
      } else {
        // No legacy URL found for this slide, or it's invalid
        if (legacyUrl) {
          console.log(
            `Found legacy URL with key '${legacyKey}', but it's invalid: ${legacyUrl}`
          )
        } else {
          console.log(`No legacy URL found with key '${legacyKey}'.`)
        }
        showInitialView() // Show initial view, no migration needed/possible
      }
    } catch (error) {
      // Error during migration attempt (e.g., getSlideID failed or other unexpected error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.warn(`Could not perform legacy URL migration: ${errorMessage}`)
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
              console.log('Slide data result:', asyncResult.value)
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
              console.error('getSelectedDataAsync error:', asyncResult.error)
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
      console.log(
        `Attempt ${retryCount} of ${maxRetries} failed:`,
        errorMessage
      )

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to get slide ID after ${maxRetries} attempts: ${errorMessage}`
        )
      }

      // Wait for a short time before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error('Failed to get slide ID') // This should never be reached due to the throw in the retry loop
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
  console.log(`Embed button clicked. URL entered: ${url}`)

  if (isValidUrl(url)) {
    // If the URL is valid
    saveUrlToSettings(url, (success) => {
      // Attempt to save the URL
      if (success) {
        // If save is successful
        console.log('URL successfully saved to settings.')
        displayIframe(url) // Display the iframe
        showMessage('URL embedded successfully.', 'success') // Show success message
      } else {
        // If save fails
        console.error('Failed to save URL to settings.')
        showMessage('Error saving URL. Please try again.', 'error') // Show error message
      }
    })
  } else {
    // If the URL is invalid
    console.warn('Invalid URL provided by user.')
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
      console.log('Document settings saved successfully.')
      if (callback) callback(true) // Notify success via callback
    } else {
      // If persistence failed
      console.error(
        'Failed to save document settings. Error: ' + asyncResult.error?.message
      )
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
  console.log(`Switching to iframe view with URL: ${url}`)

  if (!contentIframe) {
    console.error('Content iframe element not found')
    return
  }

  contentIframe.src = url // Set the source of the iframe

  // Add the CSS class to trigger fullscreen styles defined in content.html
  if (appContainer) {
    appContainer.classList.add('fullscreen-mode')
  } else {
    console.warn("'app-container' not found. Cannot apply fullscreen styles.")
  }

  // Show iframe container and change button, hide initial input area
  if (iframeContainer) {
    iframeContainer.classList.remove('hidden')
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.classList.remove('hidden')
  }
  if (urlInput?.parentElement) {
    urlInput.parentElement.classList.add('hidden') // Hide the input bar area
  }
}

/**
 * Switches the view back to the initial state where the user can enter a URL.
 * Hides the iframe container and shows the input area.
 * Removes the 'fullscreen-mode' CSS class from the main app container.
 * Clears the currently saved URL from settings and the input field.
 */
function showInitialView(): void {
  console.log('Switching back to initial view.')

  // Remove fullscreen styles
  if (appContainer) {
    appContainer.classList.remove('fullscreen-mode')
  }

  // Hide iframe container and change button, show initial input area
  if (iframeContainer) {
    iframeContainer.classList.add('hidden')
  }
  if (changeEmbeddedUrlButton) {
    changeEmbeddedUrlButton.classList.add('hidden')
  }
  if (urlInput?.parentElement) {
    urlInput.parentElement.classList.remove('hidden') // Show the input bar area
  }
  if (contentIframe) {
    contentIframe.src = 'about:blank' // Clear the iframe source
  }
  if (urlInput) {
    urlInput.value = '' // Clear the input field
  }

  // Clear the saved setting asynchronously
  Office.context.document.settings.remove(SETTINGS_KEY)
  Office.context.document.settings.saveAsync((asyncResult) => {
    // Log success or failure of clearing the setting
    if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
      console.log('Saved URL setting cleared successfully.')
    } else {
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
    /^https:\/\/manage\.klicker\.uzh\.ch\/(sessions|quizzes)\/.{36}\/evaluation\?hmac=.{64}.*$/
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
  console.log(
    `Showing message (type: ${type}, duration: ${duration}): "${message}"`
  )

  if (!messageBox || !messageText) {
    console.error('Message box elements not found in the DOM.')
    return
  }

  messageText.textContent = message // Set the message text

  // Reset any existing type classes and visibility/opacity classes
  messageBox.classList.remove(
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-yellow-400', // Warning color
    'hidden',
    'opacity-0',
    'opacity-100'
  )

  // Apply the appropriate background color based on the message type
  switch (type) {
    case 'success':
      messageBox.classList.add('bg-green-500')
      break
    case 'error':
      messageBox.classList.add('bg-red-500')
      break
    case 'info':
      messageBox.classList.add('bg-blue-500')
      break
    case 'warning':
      messageBox.classList.add('bg-yellow-400', 'text-black') // Warning often looks better with black text
      break
    default:
      messageBox.classList.add('bg-gray-500') // Default fallback color
  }

  // Make the message box visible and transition opacity
  messageBox.classList.remove('hidden')
  // Use a slight delay before setting opacity to 1 to ensure transition works
  setTimeout(() => {
    messageBox.classList.add('opacity-100')
  }, 10) // 10ms delay

  // Set a timer to hide the message box after the specified duration
  setTimeout(() => {
    messageBox.classList.remove('opacity-100')
    // Wait for the fade-out transition to complete before hiding the element
    setTimeout(() => {
      messageBox.classList.add('hidden')
      // Clear text and remove specific styling if needed
      messageText.textContent = ''
      messageBox.classList.remove('text-black') // Remove text color override if present
    }, 500) // Duration should match the CSS transition duration
  }, duration)
}
