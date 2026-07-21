# Knowledge Graph Build Model Selection

## Goal

Allow lecturers to choose the generation and cleaning models for each chatbot knowledge graph build and forward both choices to the external ingestion workflow.

## Model options

Both selectors use the same allow-list:

- `klickeruzh/azure/gpt-4.1`
- `klickeruzh/azure/gpt-5.1`
- `klickeruzh/azure/gpt-5.5`
- `klickeruzh/azure/gpt-5.4`
- `klickeruzh/azure/gpt-4.1-nano`

Both selectors default to `klickeruzh/azure/gpt-4.1-nano`.

## Design

Define the allowed external model IDs and their TypeScript type once in the shared types package. The lecturer build form renders separate generation-model and cleaning-model selectors beside the existing speed selector. Like speed mode, these choices apply to the build being submitted and are not persisted as chatbot configuration, so no database migration is required.

The rebuild GraphQL mutation accepts both model IDs as strings. The GraphQL service validates each value against the shared allow-list before claiming or queuing the build. Validated values are added to the local Hatchet task input and forwarded to the external workflow payload as `generation_model` and `cleaning_model`.

## Error handling

Unsupported model IDs fail at the GraphQL boundary before build state changes. Existing build-dispatch and external-workflow failure handling remains unchanged.

## Verification

- Unit-test external payload mapping for both fields.
- Unit-test GraphQL rejection of unsupported values and successful task input propagation.
- Regenerate GraphQL operations and run focused type, format, and test checks.
- Open the lecturer chatbot knowledge-graph form in a real local environment and confirm both selectors, defaults, options, and build submission behavior.
