import * as React from "react";
import { Progress } from "./Progress";
import { getSlideID } from "../office-utils/powerPointAPI";
import { useEffect, useState } from "react";
import { URLForm } from "./URLForm";
import { H1 } from "@uzh-bf/design-system";

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
    return <Progress message="Bitte warten Sie, während das Klicker UZH Add-in geladen wird..." />;
  }

  if (!newlyInserted) {
    const selectedURL = window.localStorage.getItem("selectedURL" + slideID);
    if (selectedURL) {
      window.location.replace(selectedURL);
    }
  }
  return (
    <div>
      <H1 className={{ root: "text-red-900 text-xl" }}>Klicker UZH: PowerPoint Add-in</H1>
      <URLForm slideID={slideID} />
    </div>
  );
}
