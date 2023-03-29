import { initializeIcons } from "@fluentui/font-icons-mdl2";
import { ThemeProvider } from "@fluentui/react";
import React from "react";
import ReactDOM from "react-dom";
import App from "./components/App";

declare const document, Office;

initializeIcons();

let isOfficeInitialized = false;
let newlyInserted = false;

const render = (Component) => {
  ReactDOM.render(
    <ThemeProvider>
      <Component isOfficeInitialized={isOfficeInitialized} newlyInserted={newlyInserted} />
    </ThemeProvider>,
    document.getElementById("container")
  );
};

/* Render application after Office initializes */
// eslint-disable-next-line office-addins/no-office-initialize
Office.initialize = function (reason) {
  if (reason === Office.InitializationReason.Inserted) {
    newlyInserted = true;
  }
  isOfficeInitialized = true;
  render(App);
};
