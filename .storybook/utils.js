import { applyMiddleware, combineReducers, compose, createStore } from 'redux'
import { reducer as formReducer } from 'redux-form'

export const configureStore = () => {
  // Get the Redux DevTools extension and fallback to a no-op function
  let devtools = f => f
  if (process.browser && window.__REDUX_DEVTOOLS_EXTENSION__) {
    devtools = window.__REDUX_DEVTOOLS_EXTENSION__()
  }

  return createStore(
    combineReducers({
      // ...your other reducers here
      // you have to pass formReducer under 'form' key,
      // for custom keys look up the docs for 'getFormState'
      form: formReducer,
    }),
    {}, // initial state
    compose(devtools), // middleware
  )
}

export const intlMock = {
  formatMessage: ({ defaultMessage }) => defaultMessage,
}
