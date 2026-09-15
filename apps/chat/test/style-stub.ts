// Empty module aliased for `*.css` imports in vitest. The design-system's
// `development` export condition resolves to its TS source, whose entrypoints
// import tailwind.css — which vite's postcss pipeline cannot process here.
export default {}
