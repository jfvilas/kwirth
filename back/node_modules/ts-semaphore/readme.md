# Semaphore

A very simple Semaphore, with an easy to use API and excellent TypeScript typings.

## Installation

```sh
npm install --save ts-semaphore
```

## Usage

```js
const Semaphore = require('ts-semaphore')

const limit = new Semaphore(2)

// Only two requests will be sent at a time

limit.use(async () => {
  console.log((await fetch('https://google.com/')).code)
})

limit.use(async () => {
  console.log((await fetch('https://twitter.com/')).code)
})

limit.use(async () => {
  console.log((await fetch('https://facebook.com/')).code)
})
```

## API

### `new Semaphore(limit: number)`

Creates a new `Semaphore` instance.

### `Semaphore#aquire(): Promise<void>`

Aquire a lock from the semaphore, returns a `Promise` that resolves when the caller holds a lock.

### `Semaphore#release(): void`

Release a lock back to the semaphore.

### `Semaphore#use<T>(fn: () => T | PromiseLike<T>): Promise<T>`

Aquire a lock from the semaphore, then run `fn`. If `fn` returns a `Promise`, wait for that promise to settle, then release the lock back to the semaphore.

Returns a `Promise` that will settle with the return value of `fn`.
