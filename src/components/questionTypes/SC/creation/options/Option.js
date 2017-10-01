// @flow

import * as React from 'react'
import classNames from 'classnames'
import { FaTrash } from 'react-icons/lib/fa'

import styles from './styles'

import type { OptionType } from '../../../../../types'

type Props = {
  ...OptionType,
  handleCorrectToggle: () => void,
  handleDelete: () => void,
}

const Option = ({ correct, name, handleCorrectToggle, handleDelete }: Props) => (
  <div className={classNames('option', { correct })}>
    <button className="leftAction" onClick={handleDelete}>
      <FaTrash />
    </button>

    <button className={classNames('toggle', { correct })} onClick={handleCorrectToggle}>
      {correct ? 'TRUE' : 'FALSE'}
    </button>

    <div className="name">{name}</div>

    <style jsx>{styles}</style>
  </div>
)

export default Option
