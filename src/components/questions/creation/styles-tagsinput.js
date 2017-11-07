/* eslint-disable import/no-unresolved, import/extensions, import/no-extraneous-dependencies */
import css from 'styled-jsx/css'

export default css`
  .react-tagsinput {
    border: 1px solid lightgrey;
    overflow: hidden;
    padding-left: 0.5rem;
    padding-top: 0.5rem;
    padding-right: 0.5rem;
  }

  .react-tagsinput--focused {
    border-color: orange;
  }

  .react-tagsinput-tag {
    background-color: lightgrey;
    border-radius: 2px;
    border: 1px solid grey;
    color: grey;
    display: inline-block;
    margin-bottom: 0.5rem;
    margin-right: 0.5rem;
    padding: 0.7rem;
    text-align: center;
    width: 100%;
  }

  .react-tagsinput-input {
    background: transparent;
    border: 0 !important;
    color: #777;
    font-weight: 400;
    margin-bottom: 0.5rem !important;
    margin-top: 1px !important;
    outline: none;
    padding: 0.7rem;
  }

  .react-autosuggest__container {
    position: relative;
    display: inline;
  }

  .react-autosuggest__suggestions-container {
    position: relative;
    top: -1px;
    z-index: 2;
  }

  .react-autosuggest__suggestion {
    cursor: pointer;
    list-style-type: none;
    padding: 0.5rem;
  }

  .react-autosuggest__suggestion--highlighted {
    background-color: lightgrey;
  }

  .react-autosuggest__input {
    padding: 0.5rem !important;
    text-align: left;
  }

  @media all and (min-width: 768px) {
    .react-tagsinput {
      padding-right: 0;
    }

    .react-tagsinput-tag {
      margin-bottom: 0.5rem;
      margin-right: 0.5rem;
      padding: 0.5rem;
      text-align: left;
      width: auto;
    }

    .react-tagsinput-remove {
      cursor: pointer;
      font-weight: bold;
    }

    .react-tagsinput-remove::before {
      content: ' ×';
    }

    .react-tagsinput-input {
      padding: 0.5rem !important;
      text-align: left;
    }
  }
`
