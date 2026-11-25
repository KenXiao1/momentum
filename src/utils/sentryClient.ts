// The only Sentry functions the app uses. Importing this module dynamically,
// rather than the whole SDK namespace, lets the bundler leave out session
// replay, feedback and the other integrations the app never starts.
export { captureException, close, init } from '@sentry/browser';
