import { H1 } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import { getSlideID } from '../office-utils/powerPointAPI'
import { URLForm } from './URLForm'

import '../../styles.css'

export default function App({
  isOfficeInitialized,
  newlyInserted,
}: {
  isOfficeInitialized: boolean
  newlyInserted: boolean
}) {
  const [slideID, setSlideID] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedURL, setSelectedURL] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function getID() {
      try {
        if (!isOfficeInitialized) {
          setError('Office is not yet initialized. Please wait...')
          return
        }
        const ID = await getSlideID()
        setSlideID(ID)
      } catch (error) {
        console.error('Error getting slide ID:', error)
        setError(
          `Failed to get slide ID. Please ensure you have selected a slide and try refreshing the add-in. ${error}`
        )
      } finally {
        setIsLoading(false)
      }
    }
    getID()
  }, [isOfficeInitialized])

  useEffect(() => {
    if (newlyInserted) return

    const URL = Office.context.document.settings.get('selectedURL' + slideID)

    if (URL) {
      setSelectedURL(URL)
    }
  }, [newlyInserted, slideID])

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  if (isLoading || !slideID) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]"
          role="status"
        ></div>
      </div>
    )
  }

  if (selectedURL) {
    return (
      <iframe
        src={selectedURL}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          border: 'none',
        }}
        title="KlickerUZH Evaluation"
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
      />
    )
  } else {
    return (
      <div className="font-sans">
        <div className="flex flex-row items-center gap-4 bg-slate-100 p-2">
          <img
            src="assets/logo-filled.png"
            alt="KlickerUZH Logo"
            className="h-16 w-16"
          ></img>
          <H1 className={{ root: '' }}>KlickerUZH: Embed Evaluation</H1>
        </div>

        <div className="p-4">
          <div className="mb-4 flex flex-row gap-4">
            <div className="flex-1">
              <ol className="list-inside list-decimal">
                <li>Go to https://manage.klicker.uzh.ch/activities</li>
                <li>
                  For the live quiz you want to embed, open the &ldquo;Embed
                  Evaluation&rdquo; dialog
                </li>
                <li>
                  Copy the link of the view to embed (the full evaluation, a
                  specific question, or the leaderboard)
                </li>
                <li>
                  Paste the link into the field and click &ldquo;Embed&rdquo;
                </li>
                <li>
                  Resize the add-in to your preferred size (e.g., to cover the
                  full slide)
                </li>
              </ol>
            </div>

            <div className="flex-1">
              <img
                src="assets/embed-modal.png"
                alt="Embed Modal"
                className="rounded border"
              />
            </div>
          </div>

          <URLForm slideID={slideID} setSelectedURL={setSelectedURL} />
        </div>
      </div>
    )
  }
}
