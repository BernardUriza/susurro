// Global polyfills for production build
if (typeof global === 'undefined') {
  window.global = window;
}

if (typeof module === 'undefined') {
  window.module = { exports: {} };
}

if (typeof exports === 'undefined') {
  window.exports = {};
}

// Ensure process exists
if (typeof process === 'undefined') {
  window.process = {
    env: {},
    version: 'v16.0.0',
    versions: {},
    platform: 'browser',
    argv: []
  };
}