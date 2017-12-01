import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { FaTrash } from 'react-icons/lib/fa'

import styles from './styles'

const propTypes = {
  correct: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  handleCorrectToggle: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
}

const defaultProps = {
  disabled: false,
}

const SCCreationOption = ({
  correct, disabled, name, handleCorrectToggle, handleDelete,
}) => (
  <div className={classNames('option', { correct })}>
    <button className="leftAction" disabled={disabled} onClick={handleDelete}>
      <FaTrash />
    </button>

    <button
      className={classNames('toggle', { correct })}
      disabled={disabled}
      onClick={handleCorrectToggle}
    >
      {correct ? 'TRUE' : 'FALSE'}
    </button>

    <div className="name">{name}</div>

    <style jsx>{styles}</style>
  </div>
)

SCCreationOption.propTypes = propTypes
SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
