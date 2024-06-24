
declare global {
  interface Array<T> {
    findLastIndex(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: any
    ): number
  }
}

declare global {
  interface Window {
    __PUBLIC_PATH__?: string;
  }
}

export {}