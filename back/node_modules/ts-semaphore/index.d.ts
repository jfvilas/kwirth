declare class Semaphore {
  constructor (limit: number)

  aquire (): Promise<void>
  release (): void

  use<T> (fn: () => T | PromiseLike<T>): Promise<T>
}

export = Semaphore
