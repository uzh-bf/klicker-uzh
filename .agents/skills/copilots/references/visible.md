# makeAssistantVisible

Higher-order component that exposes a component's rendered HTML to the assistant and optionally lets it click or edit the component.

## Contents

- [makeAssistantVisible](#makeassistantvisible)
- [Config](#config)
- [Clickable](#clickable)
- [Editable](#editable)
- [Nesting](#nesting)
- [Combining with instructions](#combining-with-instructions)
- [Notes](#notes)

## makeAssistantVisible

Wrap a component to make its `outerHTML` available as system context. The assistant can read the live HTML structure of whatever the wrapped component renders.

```tsx
import { makeAssistantVisible } from "@assistant-ui/react";

const Button = ({ onClick, children }) => (
  <button onClick={onClick}>{children}</button>
);

const ReadableButton = makeAssistantVisible(Button);
```

The returned component forwards all props and refs, so it is a drop-in replacement for the original.

## Config

Second argument is an optional config object. Both flags default to false.

```tsx
makeAssistantVisible(Component, {
  clickable?: boolean,  // register a `click` tool for this component
  editable?:  boolean,  // register an `edit` tool for an input/textarea inside it
});
```

```tsx
const ClickableButton = makeAssistantVisible(Button, { clickable: true });

const EditableInput = makeAssistantVisible(Input, { editable: true });
```

## Clickable

`clickable: true` stamps a unique `data-click-id` on the wrapped component and registers a `click` tool. The tool resolves `[data-click-id='...']` via `querySelector` and calls `.click()` on the element.

```tsx
const SmartButton = makeAssistantVisible(
  ({ onClick, children }) => <button onClick={onClick}>{children}</button>,
  { clickable: true },
);

function TransactionHistory({ transactions }) {
  return (
    <div className="transaction-list">
      {transactions.map((t) => (
        <div key={t.id} className="transaction-item">
          <span>${t.amount}</span>
          <span>{t.merchant}</span>
          <SmartButton onClick={() => handleRefund(t.id)}>
            Request Refund
          </SmartButton>
        </div>
      ))}
    </div>
  );
}
```

Note: the click tool waits 2 seconds after clicking before resolving, so the assistant observes any resulting DOM changes on its next read.

## Editable

`editable: true` stamps a `data-edit-id` and registers an `edit` tool taking `editId` and `value`. The tool finds an `<input>` or `<textarea>` inside the component, sets `.value`, then dispatches bubbling `input` and `change` events so React state updates.

```tsx
const Input = ({ label, ...props }) => (
  <div>
    <label>{label}</label>
    <input {...props} />
  </div>
);

const EditableInput = makeAssistantVisible(Input, { editable: true });

function Form() {
  return (
    <EditableInput label="Email" type="email" placeholder="Enter your email" />
  );
}
```

If the element under `data-edit-id` is not an `<input>` or `<textarea>`, the tool returns `"Element not found"`.

## Nesting

Visible components can be nested. Only the outermost wrapper contributes its `outerHTML` to the system context; nested `makeAssistantVisible` wrappers suppress their own HTML to avoid duplication. Click and edit tools from nested components stay registered regardless.

```tsx
const VisibleCard = makeAssistantVisible(Card);
const VisibleRow = makeAssistantVisible(Row, { clickable: true });

// Only VisibleCard's HTML is sent; VisibleRow rows are still clickable
<VisibleCard>
  {rows.map((r) => (
    <VisibleRow key={r.id} onClick={() => select(r.id)} />
  ))}
</VisibleCard>;
```

## Combining with instructions

Visible HTML tells the assistant what is on screen; pair it with `useAssistantInstructions` so it knows how to act on what it sees.

```tsx
import {
  makeAssistantVisible,
  useAssistantInstructions,
} from "@assistant-ui/react";

const VisibleForm = makeAssistantVisible(CheckoutForm, { editable: true });

function Checkout() {
  useAssistantInstructions(
    "Help the user fill out the checkout form. Read the form HTML, then use the edit tool to set field values.",
  );

  return <VisibleForm />;
}
```

## Notes

- Context registration runs in an effect, so HTML is captured from the mounted DOM (`componentRef.current?.outerHTML`); it reflects the current render, not stale markup.
- The wrapped type is preserved (`displayName` is copied), so the result composes like the original component in JSX.
- Clickable/editable rely on browser APIs (`document.querySelector`, `CSS.escape`, DOM events), so the tools only run client-side.
