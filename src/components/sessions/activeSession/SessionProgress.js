import React from 'react'
import { Button } from 'semantic-ui-react'

const SessionProgress = () => (
  <div className="flex">
    <div className="container">Container</div>
    <Button className="cancel" content="Abbrechen" icon="close" labelPosition="left" />
    <Button className="evaluation" content="Auswertung" icon="play" labelPosition="left" />

    <style jsx>{`
        .flex {
          display: flex;
        }
        .cancel {
          justify-content: flex-start;
        }
        .evaluation {
          justify-content: flex-end;
        }
      `}</style>
  </div>
)

export default SessionProgress
