/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./src/lib/apollo.ts":
/*!***************************!*\
  !*** ./src/lib/apollo.ts ***!
  \***************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"APOLLO_STATE_PROP_NAME\": () => (/* binding */ APOLLO_STATE_PROP_NAME),\n/* harmony export */   \"addApolloState\": () => (/* binding */ addApolloState),\n/* harmony export */   \"initializeApollo\": () => (/* binding */ initializeApollo),\n/* harmony export */   \"useApollo\": () => (/* binding */ useApollo)\n/* harmony export */ });\n/* harmony import */ var _apollo_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @apollo/client */ \"@apollo/client\");\n/* harmony import */ var _apollo_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_apollo_client__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _apollo_client_link_error__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @apollo/client/link/error */ \"@apollo/client/link/error\");\n/* harmony import */ var _apollo_client_link_error__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_apollo_client_link_error__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _apollo_client_utilities__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @apollo/client/utilities */ \"@apollo/client/utilities\");\n/* harmony import */ var _apollo_client_utilities__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_apollo_client_utilities__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var deepmerge__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! deepmerge */ \"deepmerge\");\n/* harmony import */ var deepmerge__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(deepmerge__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var next_config__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! next/config */ \"next/config\");\n/* harmony import */ var next_config__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(next_config__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var ramda__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ramda */ \"ramda\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_6__);\n/* harmony import */ var util__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! util */ \"util\");\n/* harmony import */ var util__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(util__WEBPACK_IMPORTED_MODULE_7__);\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([ramda__WEBPACK_IMPORTED_MODULE_5__]);\nramda__WEBPACK_IMPORTED_MODULE_5__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\n\n\n\n\n\n\nconst APOLLO_STATE_PROP_NAME = \"__APOLLO_STATE__\";\nlet apolloClient;\nconst { publicRuntimeConfig  } = next_config__WEBPACK_IMPORTED_MODULE_4___default()();\nconst errorLink = (0,_apollo_client_link_error__WEBPACK_IMPORTED_MODULE_1__.onError)(({ graphQLErrors , networkError  })=>{\n    if (graphQLErrors) graphQLErrors.forEach(({ message , locations , path , extensions , originalError  })=>console.log(`[GraphQL error]: Message: ${message}, Locations: ${util__WEBPACK_IMPORTED_MODULE_7___default().inspect(locations, false, null, true)}, Path: ${path}, Extensions: ${util__WEBPACK_IMPORTED_MODULE_7___default().inspect(extensions, false, null, true)}, Original: ${originalError}`));\n    if (networkError) console.log(`[Network error]: ${networkError}`);\n});\nconst httpLink = new _apollo_client__WEBPACK_IMPORTED_MODULE_0__.HttpLink({\n    uri: publicRuntimeConfig.API_URL,\n    credentials: \"include\"\n});\nfunction createApolloClient() {\n    return new _apollo_client__WEBPACK_IMPORTED_MODULE_0__.ApolloClient({\n        ssrMode: \"undefined\" === \"undefined\",\n        link: (0,_apollo_client__WEBPACK_IMPORTED_MODULE_0__.from)([\n            errorLink,\n            httpLink\n        ]),\n        cache: new _apollo_client__WEBPACK_IMPORTED_MODULE_0__.InMemoryCache({\n            typePolicies: {\n                Query: {\n                    fields: {\n                        allPosts: (0,_apollo_client_utilities__WEBPACK_IMPORTED_MODULE_2__.concatPagination)()\n                    }\n                }\n            }\n        })\n    });\n}\nfunction initializeApollo(initialState = null) {\n    const _apolloClient = apolloClient ?? createApolloClient();\n    // If your page has Next.js data fetching methods that use Apollo Client, the initial state\n    // gets hydrated here\n    if (initialState) {\n        // Get existing cache, loaded during client side data fetching\n        const existingCache = _apolloClient.extract();\n        // Merge the initialState from getStaticProps/getServerSideProps in the existing cache\n        const data = deepmerge__WEBPACK_IMPORTED_MODULE_3___default()(existingCache, initialState, {\n            // combine arrays using object equality (like in sets)\n            arrayMerge: (destinationArray, sourceArray)=>[\n                    ...sourceArray,\n                    ...destinationArray.filter((d)=>sourceArray.every((s)=>!(0,ramda__WEBPACK_IMPORTED_MODULE_5__.equals)(d, s))), \n                ]\n        });\n        // Restore the cache with the merged data\n        _apolloClient.cache.restore(data);\n    }\n    // For SSG and SSR always create a new Apollo Client\n    if (true) return _apolloClient;\n    // Create the Apollo Client once in the client\n    if (!apolloClient) apolloClient = _apolloClient;\n    return _apolloClient;\n}\nfunction addApolloState(client, pageProps) {\n    if (pageProps?.props) {\n        pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract();\n    }\n    return pageProps;\n}\nfunction useApollo(pageProps) {\n    const state = pageProps[APOLLO_STATE_PROP_NAME];\n    const store = (0,react__WEBPACK_IMPORTED_MODULE_6__.useMemo)(()=>initializeApollo(state), [\n        state\n    ]);\n    return store;\n}\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QixZQUFZLEVBQUVBLFlBQVksR0FBRzRCLGFBQWE7SUFFL0MsT0FBT0EsYUFBYTtDQUNyQjtBQUVNLFNBQVNZLGNBQWMsQ0FBQ0MsTUFBVyxFQUFFQyxTQUFjLEVBQUU7SUFDMUQsSUFBSUEsU0FBUyxFQUFFQyxLQUFLLEVBQUU7UUFDcEJELFNBQVMsQ0FBQ0MsS0FBSyxDQUFDNUMsc0JBQXNCLENBQUMsR0FBRzBDLE1BQU0sQ0FBQ3BCLEtBQUssQ0FBQ1MsT0FBTyxFQUFFO0tBQ2pFO0lBRUQsT0FBT1ksU0FBUztDQUNqQjtBQUVNLFNBQVNFLFNBQVMsQ0FBQ0YsU0FBYyxFQUFFO0lBQ3hDLE1BQU1HLEtBQUssR0FBR0gsU0FBUyxDQUFDM0Msc0JBQXNCLENBQUM7SUFDL0MsTUFBTStDLEtBQUssR0FBR2pELDhDQUFPLENBQUMsSUFBTTZCLGdCQUFnQixDQUFDbUIsS0FBSyxDQUFDLEVBQUU7UUFBQ0EsS0FBSztLQUFDLENBQUM7SUFDN0QsT0FBT0MsS0FBSztDQUNiIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vQGtsaWNrZXItdXpoL2Zyb250ZW5kLWxlYXJuaW5nLy4vc3JjL2xpYi9hcG9sbG8udHM/OWMyNCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBBcG9sbG9DbGllbnQsXG4gIGZyb20sXG4gIEh0dHBMaW5rLFxuICBJbk1lbW9yeUNhY2hlLFxuICBOb3JtYWxpemVkQ2FjaGVPYmplY3QsXG59IGZyb20gJ0BhcG9sbG8vY2xpZW50J1xuaW1wb3J0IHsgb25FcnJvciB9IGZyb20gJ0BhcG9sbG8vY2xpZW50L2xpbmsvZXJyb3InXG5pbXBvcnQgeyBjb25jYXRQYWdpbmF0aW9uIH0gZnJvbSAnQGFwb2xsby9jbGllbnQvdXRpbGl0aWVzJ1xuaW1wb3J0IG1lcmdlIGZyb20gJ2RlZXBtZXJnZSdcbmltcG9ydCBnZXRDb25maWcgZnJvbSAnbmV4dC9jb25maWcnXG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICdyYW1kYSdcbmltcG9ydCB7IHVzZU1lbW8gfSBmcm9tICdyZWFjdCdcbmltcG9ydCB1dGlsIGZyb20gJ3V0aWwnXG5cbmV4cG9ydCBjb25zdCBBUE9MTE9fU1RBVEVfUFJPUF9OQU1FID0gJ19fQVBPTExPX1NUQVRFX18nXG5cbmxldCBhcG9sbG9DbGllbnQ6IGFueVxuXG5jb25zdCB7IHB1YmxpY1J1bnRpbWVDb25maWcgfSA9IGdldENvbmZpZygpXG5cbmNvbnN0IGVycm9yTGluayA9IG9uRXJyb3IoKHsgZ3JhcGhRTEVycm9ycywgbmV0d29ya0Vycm9yIH0pID0+IHtcbiAgaWYgKGdyYXBoUUxFcnJvcnMpXG4gICAgZ3JhcGhRTEVycm9ycy5mb3JFYWNoKFxuICAgICAgKHsgbWVzc2FnZSwgbG9jYXRpb25zLCBwYXRoLCBleHRlbnNpb25zLCBvcmlnaW5hbEVycm9yIH0pID0+XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbR3JhcGhRTCBlcnJvcl06IE1lc3NhZ2U6ICR7bWVzc2FnZX0sIExvY2F0aW9uczogJHt1dGlsLmluc3BlY3QoXG4gICAgICAgICAgICBsb2NhdGlvbnMsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB0cnVlXG4gICAgICAgICAgKX0sIFBhdGg6ICR7cGF0aH0sIEV4dGVuc2lvbnM6ICR7dXRpbC5pbnNwZWN0KFxuICAgICAgICAgICAgZXh0ZW5zaW9ucyxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIHRydWVcbiAgICAgICAgICApfSwgT3JpZ2luYWw6ICR7b3JpZ2luYWxFcnJvcn1gXG4gICAgICAgIClcbiAgICApXG4gIGlmIChuZXR3b3JrRXJyb3IpIGNvbnNvbGUubG9nKGBbTmV0d29yayBlcnJvcl06ICR7bmV0d29ya0Vycm9yfWApXG59KVxuXG5jb25zdCBodHRwTGluayA9IG5ldyBIdHRwTGluayh7XG4gIHVyaTogcHVibGljUnVudGltZUNvbmZpZy5BUElfVVJMLFxuICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxufSlcblxuZnVuY3Rpb24gY3JlYXRlQXBvbGxvQ2xpZW50KCkge1xuICByZXR1cm4gbmV3IEFwb2xsb0NsaWVudCh7XG4gICAgc3NyTW9kZTogdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcsXG4gICAgbGluazogZnJvbShbZXJyb3JMaW5rLCBodHRwTGlua10pLFxuICAgIGNhY2hlOiBuZXcgSW5NZW1vcnlDYWNoZSh7XG4gICAgICB0eXBlUG9saWNpZXM6IHtcbiAgICAgICAgUXVlcnk6IHtcbiAgICAgICAgICBmaWVsZHM6IHtcbiAgICAgICAgICAgIGFsbFBvc3RzOiBjb25jYXRQYWdpbmF0aW9uKCksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSksXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0aWFsaXplQXBvbGxvKFxuICBpbml0aWFsU3RhdGUgPSBudWxsXG4pOiBBcG9sbG9DbGllbnQ8Tm9ybWFsaXplZENhY2hlT2JqZWN0PiB7XG4gIGNvbnN0IF9hcG9sbG9DbGllbnQgPSBhcG9sbG9DbGllbnQgPz8gY3JlYXRlQXBvbGxvQ2xpZW50KClcblxuICAvLyBJZiB5b3VyIHBhZ2UgaGFzIE5leHQuanMgZGF0YSBmZXRjaGluZyBtZXRob2RzIHRoYXQgdXNlIEFwb2xsbyBDbGllbnQsIHRoZSBpbml0aWFsIHN0YXRlXG4gIC8vIGdldHMgaHlkcmF0ZWQgaGVyZVxuICBpZiAoaW5pdGlhbFN0YXRlKSB7XG4gICAgLy8gR2V0IGV4aXN0aW5nIGNhY2hlLCBsb2FkZWQgZHVyaW5nIGNsaWVudCBzaWRlIGRhdGEgZmV0Y2hpbmdcbiAgICBjb25zdCBleGlzdGluZ0NhY2hlID0gX2Fwb2xsb0NsaWVudC5leHRyYWN0KClcblxuICAgIC8vIE1lcmdlIHRoZSBpbml0aWFsU3RhdGUgZnJvbSBnZXRTdGF0aWNQcm9wcy9nZXRTZXJ2ZXJTaWRlUHJvcHMgaW4gdGhlIGV4aXN0aW5nIGNhY2hlXG4gICAgY29uc3QgZGF0YSA9IG1lcmdlKGV4aXN0aW5nQ2FjaGUsIGluaXRpYWxTdGF0ZSwge1xuICAgICAgLy8gY29tYmluZSBhcnJheXMgdXNpbmcgb2JqZWN0IGVxdWFsaXR5IChsaWtlIGluIHNldHMpXG4gICAgICBhcnJheU1lcmdlOiAoZGVzdGluYXRpb25BcnJheSwgc291cmNlQXJyYXkpID0+IFtcbiAgICAgICAgLi4uc291cmNlQXJyYXksXG4gICAgICAgIC4uLmRlc3RpbmF0aW9uQXJyYXkuZmlsdGVyKChkKSA9PlxuICAgICAgICAgIHNvdXJjZUFycmF5LmV2ZXJ5KChzKSA9PiAhZXF1YWxzKGQsIHMpKVxuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KVxuXG4gICAgLy8gUmVzdG9yZSB0aGUgY2FjaGUgd2l0aCB0aGUgbWVyZ2VkIGRhdGFcbiAgICBfYXBvbGxvQ2xpZW50LmNhY2hlLnJlc3RvcmUoZGF0YSlcbiAgfVxuICAvLyBGb3IgU1NHIGFuZCBTU1IgYWx3YXlzIGNyZWF0ZSBhIG5ldyBBcG9sbG8gQ2xpZW50XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIF9hcG9sbG9DbGllbnRcbiAgLy8gQ3JlYXRlIHRoZSBBcG9sbG8gQ2xpZW50IG9uY2UgaW4gdGhlIGNsaWVudFxuICBpZiAoIWFwb2xsb0NsaWVudCkgYXBvbGxvQ2xpZW50ID0gX2Fwb2xsb0NsaWVudFxuXG4gIHJldHVybiBfYXBvbGxvQ2xpZW50XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRBcG9sbG9TdGF0ZShjbGllbnQ6IGFueSwgcGFnZVByb3BzOiBhbnkpIHtcbiAgaWYgKHBhZ2VQcm9wcz8ucHJvcHMpIHtcbiAgICBwYWdlUHJvcHMucHJvcHNbQVBPTExPX1NUQVRFX1BST1BfTkFNRV0gPSBjbGllbnQuY2FjaGUuZXh0cmFjdCgpXG4gIH1cblxuICByZXR1cm4gcGFnZVByb3BzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VBcG9sbG8ocGFnZVByb3BzOiBhbnkpIHtcbiAgY29uc3Qgc3RhdGUgPSBwYWdlUHJvcHNbQVBPTExPX1NUQVRFX1BST1BfTkFNRV1cbiAgY29uc3Qgc3RvcmUgPSB1c2VNZW1vKCgpID0+IGluaXRpYWxpemVBcG9sbG8oc3RhdGUpLCBbc3RhdGVdKVxuICByZXR1cm4gc3RvcmVcbn1cbiJdLCJuYW1lcyI6WyJBcG9sbG9DbGllbnQiLCJmcm9tIiwiSHR0cExpbmsiLCJJbk1lbW9yeUNhY2hlIiwib25FcnJvciIsImNvbmNhdFBhZ2luYXRpb24iLCJtZXJnZSIsImdldENvbmZpZyIsImVxdWFscyIsInVzZU1lbW8iLCJ1dGlsIiwiQVBPTExPX1NUQVRFX1BST1BfTkFNRSIsImFwb2xsb0NsaWVudCIsInB1YmxpY1J1bnRpbWVDb25maWciLCJlcnJvckxpbmsiLCJncmFwaFFMRXJyb3JzIiwibmV0d29ya0Vycm9yIiwiZm9yRWFjaCIsIm1lc3NhZ2UiLCJsb2NhdGlvbnMiLCJwYXRoIiwiZXh0ZW5zaW9ucyIsIm9yaWdpbmFsRXJyb3IiLCJjb25zb2xlIiwibG9nIiwiaW5zcGVjdCIsImh0dHBMaW5rIiwidXJpIiwiQVBJX1VSTCIsImNyZWRlbnRpYWxzIiwiY3JlYXRlQXBvbGxvQ2xpZW50Iiwic3NyTW9kZSIsImxpbmsiLCJjYWNoZSIsInR5cGVQb2xpY2llcyIsIlF1ZXJ5IiwiZmllbGRzIiwiYWxsUG9zdHMiLCJpbml0aWFsaXplQXBvbGxvIiwiaW5pdGlhbFN0YXRlIiwiX2Fwb2xsb0NsaWVudCIsImV4aXN0aW5nQ2FjaGUiLCJleHRyYWN0IiwiZGF0YSIsImFycmF5TWVyZ2UiLCJkZXN0aW5hdGlvbkFycmF5Iiwic291cmNlQXJyYXkiLCJmaWx0ZXIiLCJkIiwiZXZlcnkiLCJzIiwicmVzdG9yZSIsImFkZEFwb2xsb1N0YXRlIiwiY2xpZW50IiwicGFnZVByb3BzIiwicHJvcHMiLCJ1c2VBcG9sbG8iLCJzdGF0ZSIsInN0b3JlIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./src/lib/apollo.ts\n");

/***/ }),

/***/ "./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _apollo_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @apollo/client */ \"@apollo/client\");\n/* harmony import */ var _apollo_client__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_apollo_client__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _fortawesome_fontawesome_svg_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @fortawesome/fontawesome-svg-core */ \"@fortawesome/fontawesome-svg-core\");\n/* harmony import */ var _fortawesome_fontawesome_svg_core__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_fortawesome_fontawesome_svg_core__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _fortawesome_fontawesome_svg_core_styles_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @fortawesome/fontawesome-svg-core/styles.css */ \"../../node_modules/@fortawesome/fontawesome-svg-core/styles.css\");\n/* harmony import */ var _fortawesome_fontawesome_svg_core_styles_css__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_fortawesome_fontawesome_svg_core_styles_css__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _lib_apollo__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/apollo */ \"./src/lib/apollo.ts\");\n/* harmony import */ var _globals_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../globals.css */ \"./src/globals.css\");\n/* harmony import */ var _globals_css__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_globals_css__WEBPACK_IMPORTED_MODULE_5__);\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_lib_apollo__WEBPACK_IMPORTED_MODULE_4__]);\n_lib_apollo__WEBPACK_IMPORTED_MODULE_4__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\n\n\n_fortawesome_fontawesome_svg_core__WEBPACK_IMPORTED_MODULE_2__.config.autoAddCss = false;\n\n\nfunction App({ Component , pageProps  }) {\n    const apolloClient = (0,_lib_apollo__WEBPACK_IMPORTED_MODULE_4__.useApollo)(pageProps);\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_apollo_client__WEBPACK_IMPORTED_MODULE_1__.ApolloProvider, {\n        client: apolloClient,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n            ...pageProps\n        }, void 0, false, {\n            fileName: \"/home/florina/Codes/klicker-uzh/apps/frontend-learning/src/pages/_app.tsx\",\n            lineNumber: 17,\n            columnNumber: 7\n        }, this)\n    }, void 0, false, {\n        fileName: \"/home/florina/Codes/klicker-uzh/apps/frontend-learning/src/pages/_app.tsx\",\n        lineNumber: 16,\n        columnNumber: 5\n    }, this);\n}\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (App);\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3guanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBK0M7QUFHVztBQUNMO0FBQ3JEQyxnRkFBaUIsR0FBRyxLQUFLO0FBRWdCO0FBRWxCO0FBRXZCLFNBQVNHLEdBQUcsQ0FBQyxFQUFFQyxTQUFTLEdBQUVDLFNBQVMsR0FBWSxFQUFFO0lBQy9DLE1BQU1DLFlBQVksR0FBR0osc0RBQVMsQ0FBQ0csU0FBUyxDQUFDO0lBRXpDLHFCQUNFLDhEQUFDTiwwREFBYztRQUFDUSxNQUFNLEVBQUVELFlBQVk7a0JBQ2xDLDRFQUFDRixTQUFTO1lBQUUsR0FBR0MsU0FBUzs7Ozs7Z0JBQUk7Ozs7O1lBQ2IsQ0FDbEI7Q0FDRjtBQUVELGlFQUFlRixHQUFHIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vQGtsaWNrZXItdXpoL2Zyb250ZW5kLWxlYXJuaW5nLy4vc3JjL3BhZ2VzL19hcHAudHN4P2Y5ZDYiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBvbGxvUHJvdmlkZXIgfSBmcm9tICdAYXBvbGxvL2NsaWVudCdcbmltcG9ydCB0eXBlIHsgQXBwUHJvcHMgfSBmcm9tICduZXh0L2FwcCdcblxuaW1wb3J0IHsgY29uZmlnIH0gZnJvbSAnQGZvcnRhd2Vzb21lL2ZvbnRhd2Vzb21lLXN2Zy1jb3JlJ1xuaW1wb3J0ICdAZm9ydGF3ZXNvbWUvZm9udGF3ZXNvbWUtc3ZnLWNvcmUvc3R5bGVzLmNzcydcbmNvbmZpZy5hdXRvQWRkQ3NzID0gZmFsc2VcblxuaW1wb3J0IHsgdXNlQXBvbGxvIH0gZnJvbSAnLi4vbGliL2Fwb2xsbydcblxuaW1wb3J0ICcuLi9nbG9iYWxzLmNzcydcblxuZnVuY3Rpb24gQXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfTogQXBwUHJvcHMpIHtcbiAgY29uc3QgYXBvbGxvQ2xpZW50ID0gdXNlQXBvbGxvKHBhZ2VQcm9wcylcblxuICByZXR1cm4gKFxuICAgIDxBcG9sbG9Qcm92aWRlciBjbGllbnQ9e2Fwb2xsb0NsaWVudH0+XG4gICAgICA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+XG4gICAgPC9BcG9sbG9Qcm92aWRlcj5cbiAgKVxufVxuXG5leHBvcnQgZGVmYXVsdCBBcHBcbiJdLCJuYW1lcyI6WyJBcG9sbG9Qcm92aWRlciIsImNvbmZpZyIsImF1dG9BZGRDc3MiLCJ1c2VBcG9sbG8iLCJBcHAiLCJDb21wb25lbnQiLCJwYWdlUHJvcHMiLCJhcG9sbG9DbGllbnQiLCJjbGllbnQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n");

/***/ }),

/***/ "./src/globals.css":
/*!*************************!*\
  !*** ./src/globals.css ***!
  \*************************/
/***/ (() => {



/***/ }),

/***/ "../../node_modules/@fortawesome/fontawesome-svg-core/styles.css":
/*!***********************************************************************!*\
  !*** ../../node_modules/@fortawesome/fontawesome-svg-core/styles.css ***!
  \***********************************************************************/
/***/ (() => {



/***/ }),

/***/ "@apollo/client":
/*!*********************************!*\
  !*** external "@apollo/client" ***!
  \*********************************/
/***/ ((module) => {

"use strict";
module.exports = require("@apollo/client");

/***/ }),

/***/ "@apollo/client/link/error":
/*!********************************************!*\
  !*** external "@apollo/client/link/error" ***!
  \********************************************/
/***/ ((module) => {

"use strict";
module.exports = require("@apollo/client/link/error");

/***/ }),

/***/ "@apollo/client/utilities":
/*!*******************************************!*\
  !*** external "@apollo/client/utilities" ***!
  \*******************************************/
/***/ ((module) => {

"use strict";
module.exports = require("@apollo/client/utilities");

/***/ }),

/***/ "@fortawesome/fontawesome-svg-core":
/*!****************************************************!*\
  !*** external "@fortawesome/fontawesome-svg-core" ***!
  \****************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("@fortawesome/fontawesome-svg-core");

/***/ }),

/***/ "deepmerge":
/*!****************************!*\
  !*** external "deepmerge" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = require("deepmerge");

/***/ }),

/***/ "next/config":
/*!******************************!*\
  !*** external "next/config" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/config");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("react");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

"use strict";
module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "ramda":
/*!************************!*\
  !*** external "ramda" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = import("ramda");;

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("./src/pages/_app.tsx"));
module.exports = __webpack_exports__;

})();