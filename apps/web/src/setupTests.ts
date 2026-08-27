import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver — cmdk (Command/Popover-based comboboxes,
// e.g. SearchCombobox) and Radix's positioning both use it, so any test that opens
// one throws ReferenceError without this stub.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom doesn't implement scrollIntoView either — cmdk calls it on the
// highlighted option whenever the list re-renders (e.g. after filtering).
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {}
}
