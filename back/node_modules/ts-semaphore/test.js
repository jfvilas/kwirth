const assert = require('assert')
const assertRejects = require('assert-rejects')
const sleep = require('p-sleep')

const Semaphore = require('./')

assert.throws(() => new Semaphore(0), Error)
assert.throws(() => new Semaphore(-1), Error)

// @ts-ignore
assert.throws(() => new Semaphore('bad'), TypeError)

const a = new Semaphore(4)

let total = 0
let current = 0
let max = 0

Promise.all([
  // Aquire
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),
  a.aquire().then(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20) }).then(() => { current -= 1; return a.release() }),

  // Use
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),
  a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1 }) }),

  // Use with errors
  assertRejects(a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1; throw new Error('Test') }) }), /Test/),
  assertRejects(a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1; throw new Error('Test') }) }), /Test/),
  assertRejects(a.use(() => { total += 1; current += 1; max = Math.max(max, current); return sleep(20).then(() => { current -= 1; throw new Error('Test') }) }), /Test/)
]).then(() => {
  assert.strictEqual(total, 26)
  assert.strictEqual(current, 0)
  assert.strictEqual(max, 4)
}).catch((err) => {
  process.exitCode = 1
  console.error(err.stack)
})
