import { H1 } from "@uzh-bf/design-system";
import React, { useEffect, useState } from "react";
import { getSlideID } from "../office-utils/powerPointAPI";
import { Progress } from "./Progress";
import { URLForm } from "./URLForm";

/* global window*/

export interface AppProps {
  title: string;
  isOfficeInitialized: boolean;
  newlyInserted: boolean;
}

export default function App({ isOfficeInitialized, newlyInserted }: AppProps) {
  const [slideID, setSlideID] = useState(undefined);

  useEffect(() => {
    async function getID() {
      const ID = await getSlideID();
      setSlideID(ID);
    }
    if (isOfficeInitialized) {
      getID();
    }
  }, [isOfficeInitialized]);

  if (!isOfficeInitialized) {
    return <Progress message="Bitte warten Sie, während das KlickerUZH Add-in geladen wird..." />;
  }

  if (!newlyInserted) {
    const selectedURL = window.localStorage.getItem("selectedURL" + slideID);
    if (selectedURL) {
      window.location.replace(selectedURL);
    }
  }
  return (
    <div className="m-10">
      <H1 className={{ root: "text-xl text-red-900" }}>KlickerUZH: PowerPoint Add-in</H1>
      <img src="assets/logo-filled.png" alt="KlickerUZH Logo" className="my-12 ml-auto mr-auto h-72 w-72"></img>
      <URLForm slideID={slideID} />
    </div>
  );
}
