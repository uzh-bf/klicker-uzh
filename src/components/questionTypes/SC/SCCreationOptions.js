// @flow

import classNames from 'classnames'
import React from 'react'
import Icon from 'react-fontawesome'

type Props = {
  options: Array<{
    correct: boolean,
    name: string,
  }>,
}

const defaultProps = {
  options: [],
}

class PlaceholderInput extends React.Component {
  state = {
    correct: false,
    inputMode: false,
    name: '',
  }

  handleSave = (e) => {
    e.preventDefault()

    console.log(this.state.name, this.state.correct)
    this.setState({ inputMode: false })
  }

  handleNameChange = (e) => {
    this.setState({ name: e.target.value })
  }

  render() {
    const { correct, inputMode } = this.state
    return (
      <div className={classNames('placeholderInput', { inputMode })}>
        <button className="inputActivate" onClick={() => this.setState({ inputMode: !inputMode })}>
          <Icon name={inputMode ? 'trash' : 'plus'} />
        </button>
        <button
          className={classNames('toggle', { correct })}
          onClick={() => this.setState({ correct: !correct })}
        >
          <Icon name={correct ? 'check' : 'times'} />
        </button>

        <input className="input" type="text" value={this.state.name} onChange={this.handleNameChange} />
        <button className="save" type="submit" onClick={this.handleSave}>
          <Icon name="save" />
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
          }

          .toggle.correct {
            background-color: green;
          }

          .inputActivate {
            flex: 0 0 100%;

            transition: flex-basis 0.5s;
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

const SCCreationOptions = ({ options }: Props) => (
  <div className="options">
    {options.map(({ correct, name }) => (
      <div className={classNames('option', { correct })}>{name}</div>
    ))}

    <PlaceholderInput />

    <style jsx>{`
      .options {
      }

      .option {
        border: 1px solid grey;
        padding: 1rem;
        text-align: center;
      }

      .option:not(:last-child) {
        margin-bottom: 0.5rem;
      }

      .option:hover {
      }

      .correct {
        border-color: green;
      }
    `}</style>
  </div>
)

SCCreationOptions.defaultProps = defaultProps

export default SCCreationOptions
