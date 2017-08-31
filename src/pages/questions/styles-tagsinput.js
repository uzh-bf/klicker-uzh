export default `
  .react-tagsinput {
    border: 1px solid lightgrey;
    overflow: hidden;
    padding-left: .5rem;
    padding-top: .5rem;
    // height: 100%;
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
    padding: .5rem;
  }

  .react-tagsinput-remove {
    cursor: pointer;
    font-weight: bold;
  }

  .react-tagsinput-tag a::before {
    content: ' ×';
  }

  .react-tagsinput-input {
    background: transparent;
    border: 0;
    color: #777;
    font-weight: 400;
    margin-bottom: .5rem;
    margin-top: 1px;
    outline: none;
    padding: .5rem;
  }
`
