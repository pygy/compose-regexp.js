import { map } from './_util.js'
export { compileFlags, currentFlags, diff, gatherFlags, inter, parseFlags, union }

// parse/compile
// -------------

function parseFlags (f) {
  if (f == null) {console.trace();return {}}
  return f.split('').reduce((acc, f) => {
    return (acc[f] = true, acc)
  }, Object.create(null))
}

function compileFlags (fl) {
  return Object.keys(fl).filter(f => fl[f]).join('')
}

// collect the current flags
// Rely on the fact that the combinators are not reentrant and store the common
// flags in the root scope.
let currentFlags = {}

function gatherFlags () {
  currentFlags = map.call(
    arguments,
    // input can actually be a non-regexp hence the `|| ''`
    input => parseFlags(input.flags || '')
  )
  .reduce(union, {})
}

// set operations
// --------------

function union (a, b) {
  return Object.assign(a, b)
}

function inter (a, b) {
  Object.keys(a).forEach(f => {if (!b[f]) delete a[f]})
  return a
}

function diff (a, b) {
  Object.keys(a).forEach(f => {if (b[f]) delete a[f]})
  return a
}
