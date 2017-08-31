// @flow

import React from 'react'
import classNames from 'classnames'
import { FaFloppyO, FaPlus, FaTrash } from 'react-icons/lib/fa'

type Props = {
  handleSave: ({
    correct: boolean,
    name: string,
  }) => void,
}

class PlaceholderInput extends React.Component {
  props: Props
  state = {
    correct: false,
    inputMode: false,
    name: '',
  }

  handleSave = (e) => {
    e.preventDefault()

    this.setState({ correct: false, inputMode: false, name: '' })
    this.props.handleSave({ correct: this.state.correct, name: this.state.name })
  }

  handleNameChange = (e) => {
    this.setState({ name: e.target.value })
  }

  render() {
    const { correct, inputMode } = this.state
    return (
      <div className={classNames('placeholderInput', { inputMode })}>
        <button className="inputActivate" onClick={() => this.setState({ inputMode: !inputMode })}>
          {inputMode ? <FaTrash /> : <FaPlus />}
        </button>
        <button
          className={classNames('toggle', { correct })}
          onClick={() => this.setState({ correct: !correct })}
        >
          {correct ? 'TRUE' : 'FALSE'}
        </button>

        <input
          className="input"
          type="text"
          value={this.state.name}
          onChange={this.handleNameChange}
        />
        <button className="save" type="submit" onClick={this.handleSave}>
          <FaFloppyO />
        </button>

        <style jsx>{`
          .placeholderInput {
            display: flex;

            border: 1px solid grey;
            position: relative;
            overflow: hidden;
          }

          .inputActivate,
          .save,
          .toggle {
            border: none;
            box-shadow: none;
            cursor: pointer;
            text-align: center;
          }

          .inputActivate,
          .save {
            background-color: lightgrey;
            padding: 1rem;
          }

          .toggle {
            background-color: red;
            border: 1px solid lightgrey;

            width: 4rem;
          }

          .toggle.correct {
            background-color: green;
          }

          .inputActivate {
            flex: 0 0 100%;

            transition: flex-basis 0.3s;
          }

          .input {
            flex: 1;

            border: none;
            box-shadow: none;
            opacity: 0;

            padding: 1rem;
          }

          .input:focus {
            outline-color: none;
          }
          .save,
          .toggle {
            flex: 1;

            opacity: 0;
          }

          .inputMode > .inputActivate {
            flex: 0 0 3rem;

            border-right: 1px solid grey;
          }

          .inputMode > .input {
            flex: 1;
            opacity: 1;
          }

          .inputMode > .toggle {
            margin: 0.5rem;
            flex: 0 0 4rem;
            opacity: 1;
          }

          .inputMode > .save {
            flex: 0 0 3rem;
            opacity: 1;

            border-left: 1px solid grey;
          }
        `}</style>
      </div>
    )
  }
}

export default PlaceholderInput
