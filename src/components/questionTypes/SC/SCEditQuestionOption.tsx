import React from 'react'
import { Icon, Input } from 'semantic-ui-react'
import styles from './styles'

interface Props {
  name: string
  handleSaveNewName: any
}

function SCEditQuestionOption({ name, handleSaveNewName }: Props): React.ReactElement {
  return (
    <div className="SCEditQuestionOption">
      <Input type="text" value={name} onChange={e => handleSaveNewName({ newName: e.target.value })} />

      <div className="grabHandle">
        <Icon name="grab" />
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

export default SCEditQuestionOption
