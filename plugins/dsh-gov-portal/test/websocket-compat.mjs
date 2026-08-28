/**
 * Minimal EventEmitter-style adapter for Node.js' built-in WHATWG WebSocket.
 * The browser checks historically used the `ws` package's on/off API; keeping
 * the adapter local makes the public test suite portable without a dev-only
 * dependency or a machine-specific import path.
 */
const NativeWebSocket = globalThis.WebSocket

if (typeof NativeWebSocket !== 'function') {
  throw new Error('Node.js >= 22.19.0 is required for the built-in WebSocket client')
}

export class WebSocket extends NativeWebSocket {
  #listeners = new Map()

  on (type, listener) {
    const wrapped = type === 'message'
      ? event => listener(event.data)
      : event => listener(event)
    const listenersForType = this.#listeners.get(type) ?? new Map()
    listenersForType.set(listener, wrapped)
    this.#listeners.set(type, listenersForType)
    this.addEventListener(type, wrapped)
    return this
  }

  off (type, listener) {
    const listenersForType = this.#listeners.get(type)
    const wrapped = listenersForType?.get(listener)
    if (wrapped) {
      this.removeEventListener(type, wrapped)
      listenersForType.delete(listener)
    }
    return this
  }
}
