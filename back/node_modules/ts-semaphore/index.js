const kLimit = Symbol('limit')
const kQueue = Symbol('queue')
const kUsed = Symbol('used')

class Semaphore {
  constructor (limit) {
    if (typeof limit !== 'number') {
      throw new TypeError(`Expected limit to be a number, got ${typeof limit}`)
    }

    if (limit < 1) {
      throw new Error('limit cannot be less than 1')
    }

    this[kLimit] = limit
    this[kQueue] = []
    this[kUsed] = 0
  }

  aquire () {
    if (this[kUsed] < this[kLimit]) {
      this[kUsed] += 1
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this[kQueue].push(resolve)
    })
  }

  release () {
    if (this[kQueue].length) {
      this[kQueue].shift()()
    } else {
      this[kUsed] -= 1
    }
  }

  use (fn) {
    return this.aquire().then(fn).then(
      (val) => { this.release(); return val },
      (err) => { this.release(); throw err }
    )
  }
}

module.exports = Semaphore
