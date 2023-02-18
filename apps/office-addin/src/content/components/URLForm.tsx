import { Button, FormikTextField } from "@uzh-bf/design-system";
import { Form, Formik } from "formik";
import React from "react";

/* global window*/

export interface URLFormProps {
  slideID: string;
}

export function URLForm({ slideID }: URLFormProps) {
  return (
    <Formik
      initialValues={{
        url: "",
      }}
      onSubmit={async (values) => {
        window.localStorage.setItem("selectedURL" + slideID, values.url);
        window.location.replace(values.url);
      }}
    >
      <Form className="flex flex-row w-full">
        <FormikTextField
          required
          name="url"
          label="URL"
          tooltip="Die URL der KlickerUZH Auswertungs-Seite (evaluation page), die Sie hier einbetten möchten"
          className={{ root: "flex-row w-3/4", input: "mr-8" }}
          placeholder="https://manage.klicker.uzh.ch/sessions/12345-12345/evaluation"
        />
        <Button type="submit">einbetten</Button>
      </Form>
    </Formik>
  );
}

export default URLForm;
