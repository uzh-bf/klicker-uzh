/* eslint-disable import/no-unresolved, import/extensions, import/no-extraneous-dependencies */
import css from 'styled-jsx/css'

export default css`
  button {
    border: none;
    box-shadow: none;
    cursor: pointer;
    text-align: center;
  }

  button:hover {
  }

  input {
    border: none;
    box-shadow: none;
  }

  .option {
    display: flex;

    background-color: white;
    border: 1px solid grey;
    position: relative;
    overflow: hidden;
  }

  .option.correct {
    border-color: green;
  }

  input,
  .leftAction,
  .rightAction,
  .name {
    padding: 1rem;
  }

  .leftAction {
    border-right: 1px solid grey;
  }

  .rightAction {
    border-left: 1px solid grey;
  }

  .toggle {
    background-color: red;
    border: 1px solid lightgrey;
    color: white;
    margin: 0.5rem;
    width: 5rem;
  }

  .toggle.correct {
    background-color: green;
  }
`
