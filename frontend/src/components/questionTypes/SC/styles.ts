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
    border: 2px solid grey;
    position: relative;
    overflow: hidden;

    cursor: grab;
    margin-bottom: 0.5rem;
  }

  .SCEditQuestionOption {
    width: 100%;
    display: flex;
    inline-size: -webkit-fill-available;
  }

  .moveHandles {
    flex: 0 0 1rem;
    padding: 0;

    :global(button.ui.basic.button) {
      border: 0;
      box-shadow: none;
      padding: 0.5rem;
      margin-right: 0;
    }
  }

  .option.correct {
    border: 2px solid green;
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

  .toggle.disabled {
    background-color: lightgrey;
  }
`
