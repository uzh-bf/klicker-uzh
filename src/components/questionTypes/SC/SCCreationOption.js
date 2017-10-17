import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { FaTrash } from 'react-icons/lib/fa'

import styles from './styles'

const propTypes = {
  correct: PropTypes.bool.isRequired,
  handleCorrectToggle: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
}

const SCCreationOption = ({
  correct, name, handleCorrectToggle, handleDelete,
}) => (
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

SCCreationOption.propTypes = propTypes

export default SCCreationOption
