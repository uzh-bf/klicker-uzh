/* eslint-disable import/no-unresolved, import/extensions, import/no-extraneous-dependencies */
import css from 'styled-jsx/css'

export default css`
  button {
    border: none;
    box-shadow: none;
    cursor: pointer;
    text-align: center;
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

  .optionEditCont {
    display: flex;
    inline-size: -webkit-fill-available;
  }

  .editOptBtnRight {
    display: flex;
  }

  .optionEdit {
    inline-size: -webkit-fill-available;
    height: inherit;
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
    padding-left: 0.5rem;
    padding-right: 0.5rem;

    :global(i) {
      margin: 0;
    }
  }

  .toggle.correct {
    background-color: green;
  }
`
