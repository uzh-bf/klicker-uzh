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

    cursor: grab;
    margin-bottom: 0.5rem;

    &:hover {
      box-shadow: 0 0 0.2rem blue;
      -webkit-transition: all 0.1s;
      transition: all 0.1s;
    }
  }

  .SCEditQuestionOption {
    width: 100%;
    display: flex;
    inline-size: -webkit-fill-available;
  }

  .grabHandle {
    flex: 0 0 auto;
    padding: 0 0.5rem;

    :global(i.grab.icon) {
      color: grey;
    }
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
