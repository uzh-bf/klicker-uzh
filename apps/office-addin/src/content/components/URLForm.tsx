import { Button, FormikTextField, FormikTextField } from "@uzh-bf/design-system";
import { Form, Formik } from "formik";
import React from "react";
import * as yup from "yup";

/* global window*/

declare const Office;

export interface URLFormProps {
  slideID: string;
}

export function URLForm({ slideID }: URLFormProps) {
  return (
    <Formik
      initialValues={{
        url: "",
      }}
      validationSchema={yup.object({
        url: yup
          .string()
          .matches(
            /https:\/\/manage\.klicker\.uzh\.ch\/sessions\/.{36}\/evaluation\?hmac=.{64}.*/,
            "Please enter a valid URL according to the steps described"
          )
          .required("Please enter a valid URL according to the steps described"),
      })}
      onSubmit={async (values) => {
        // window.localStorage.setItem("selectedURL" + slideID, values.url);
        Office.context.document.settings.set("selectedURL" + slideID, values.url);
        Office.context.document.settings.saveAsync();
        window.location.replace(values.url);
      }}
    >
      <Form className="flex flex-row w-full gap-4">
        <FormikTextField
          required
          autoComplete="off"
          name="url"
          label="URL"
          labelType="large"
          tooltip="Enter the embedding URL of the evaluation you want to add to this slide"
          className={{ root: "w-full" }}
          placeholder="https://manage.klicker.uzh.ch/sessions/12345/evaluation?hmac=xyz"
          data={{ cy: "url-form-input" }}
        />
        <Button type="submit">Embed</Button>
      </Form>
    </Formik>
  );
}

export default URLForm;
