import { H1 } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'
import { getSlideID } from '../office-utils/powerPointAPI'
import { URLForm } from './URLForm'

/* global window*/

declare const Office

export interface AppProps {
  title: string
  isOfficeInitialized: boolean
  newlyInserted: boolean
}

export default function App({ isOfficeInitialized, newlyInserted }: AppProps) {
  const [slideID, setSlideID] = useState(undefined)

  useEffect(() => {
    async function getID() {
      const ID = await getSlideID()
      setSlideID(ID)
    }
    if (isOfficeInitialized) {
      getID()
    }
  }, [isOfficeInitialized])

  // HACK: comment for browser-based dev
  if (!isOfficeInitialized) {
    return <div>Please wait while the KlickerUZH Add-in is loading...</div>
  }

  if (!newlyInserted) {
    // const selectedURL = window.localStorage.getItem("selectedURL" + slideID);
    const selectedURL = Office.context.document.settings.get(
      'selectedURL' + slideID
    )
    if (selectedURL) {
      window.location.replace(selectedURL)
    }
  }
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
              <li>Go to https://manage.klicker.uzh.ch/sessions</li>
              <li>
                For the quiz you want to embed, open the &ldquo;Embed
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
            ></img>
          </div>
        </div>
        <URLForm slideID={slideID} />
      </div>
    </div>
  )
}
