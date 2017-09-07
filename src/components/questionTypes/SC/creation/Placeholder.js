// @flow

import React from 'react'
import classNames from 'classnames'
import { FaFloppyO, FaPlus, FaTrash } from 'react-icons/lib/fa'

import styles from './styles'

type Props = {
  handleSave: ({
    correct: boolean,
    name: string,
  }) => void,
}

class Placeholder extends React.Component {
  props: Props
  state = {
    correct: false,
    inputMode: false,
    name: '',
  }

  handleModeToggle = () => {
    this.setState(prevState => ({ inputMode: !prevState.inputMode }))
  }

  handleSave = () => {
    this.setState({ correct: false, inputMode: false, name: '' })
    this.props.handleSave({ correct: this.state.correct, name: this.state.name })
  }

  handleNameChange = (e: SyntheticInputEvent) => {
    this.setState({ name: e.target.value })
  }

  render() {
    const { correct, inputMode } = this.state
    return (
      <div className={classNames('option', { inputMode })}>
        <button className="leftAction" onClick={this.handleModeToggle}>
          {inputMode ? <FaTrash /> : <FaPlus />}
        </button>

        <button
          className={classNames('toggle', { correct })}
          onClick={() => this.setState({ correct: !correct })}
        >
          {correct ? 'TRUE' : 'FALSE'}
        </button>

        <input type="text" value={this.state.name} onChange={this.handleNameChange} />

        <button className="rightAction" type="submit" onClick={this.handleSave}>
          <FaFloppyO />
        </button>

        <style jsx>{styles}</style>
        <style jsx>{`
          .leftAction {
            flex: 0 0 100%;

            border-right: none;
            transition: flex-basis 0.3s;
          }

          input,
          .toggle,
          .rightAction {
            flex: 1;

            opacity: 0;
          }

          .inputMode > input,
          .inputMode > .toggle,
          .inputMode > .rightAction {
            opacity: 1;
          }

          .inputMode > .leftAction,
          .inputMode > .rightAction {
            flex: 0 0 3rem;
          }

          .inputMode > .leftAction {
            border-right: 1px solid grey;
          }

          .inputMode > .toggle {
            flex: 0 0 5rem;
          }

          .inputMode > input {
            flex: 1;
          }
        `}</style>
      </div>
    )
  }
}

export default Placeholder
