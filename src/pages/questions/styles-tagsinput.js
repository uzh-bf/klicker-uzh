export default `
  .react-tagsinput {
    border: 1px solid lightgrey;
    overflow: hidden;
    padding-left: .5rem;
    padding-top: .5rem;
    padding-right: .5rem;
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
    margin-bottom: .5rem;
    margin-right: .5rem;
    padding: .7rem;
    text-align: center;
    width: 100%;
  }

  .react-tagsinput-input {
    background: transparent;
    border: 0 !important;
    color: #777;
    font-weight: 400;
    margin-bottom: .5rem !important;
    margin-top: 1px !important;
    outline: none;
    padding: .7rem;
  }

  @media all and (min-width: 768px) {
    .react-tagsinput {
      padding-right: 0;
    }

    .react-tagsinput-tag {
      margin-bottom: .5rem;
      margin-right: .5rem;
      padding: .5rem;
      text-align: left;
      width: auto;
    }

    .react-tagsinput-remove {
      cursor: pointer;
      font-weight: bold;
    }

    .react-tagsinput-tag a::before {
      content: ' ×';
    }

    .react-tagsinput-input {
      padding: .5rem !important;
      text-align: left;
    }

    .react-autosuggest__container {
      position: relative;
      display: inline;
    }
    .react-autosuggest__input {
      width: 240px;
      height: 30px;
      padding: 10px 20px;
      font-family: 'Open Sans', sans-serif;
      font-weight: 300;
      font-size: 16px;
      border: 1px solid #aaa;
      border-radius: 4px;
    }
    .react-autosuggest__input:focus {
      outline: none;
    }
    .react-autosuggest__container--open .react-autosuggest__input {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
    .react-autosuggest__suggestions-container {
      position: relative;
      top: -1px;
      width: 280px;
      margin: 0;
      padding: 0;
      list-style-type: none;
      border: 1px solid #aaa;
      background-color: #fff;
      font-family: 'Open Sans', sans-serif;
      font-weight: 300;
      font-size: 16px;
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      z-index: 2;
    }
    .react-autosuggest__suggestion {
      cursor: pointer;
      padding: 10px 20px;
    }
    .react-autosuggest__suggestion--focused {
      background-color: #ddd;
    }
  }
`
