import React from 'react'
import { Button, Icon } from 'semantic-ui-react'

import Question from './Question'

const SessionProgress = () => (
  <div className="container">
    <div className="sessionContainer">
      <div className="topRow">
        <div><Icon name="time" /> Start</div>
        <div><Icon name="play circle" /> Laufzeit</div>
        <div>Sessions</div>
      </div>
      <div className="content">
        <Question status="Aktiv" title="Hello World" type="MC" />
      </div>
    </div>
    <div className="buttonSection">
      {/* TODO evaluation button floating to the right */}
      <Button className="cancel" content="Abbrechen" icon="close" labelPosition="left" />
      <Button className="evaluation" content="Auswertung" icon="play" labelPosition="left" />
    </div>

    <style jsx>{`
        .container {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }
        .sessionContainer {
          background-color: lightgrey;
          border: 1px solid;
          flex: 0 0 100%;
          margin-bottom: 0.5rem;
        }
        .sessionContainer > .topRow {
          display: flex;
          border-bottom: 1px solid;
          padding: 0.5rem;
        }
        .sessionContainer > .topRow > div {
          margin: 0 0.5rem;
        }
        .sessionContainer > .content {
          display: flex;
          padding: 0.5rem;
        }
        .buttonSection {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        }
        .cancel {
          flex: 0 0 20%
          justify-content: flex-start;
        }
        .evaluation {
          flex: 0 0 20%
          justify-content: flex-end;
        }
      `}</style>
  </div>
)

export default SessionProgress
