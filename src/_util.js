export const empty = new RegExp('')
export const hasOwn = ({}).hasOwnProperty
export const map = [].map

// applyCall(f, arguments) passes all but the first arguments to `f`.
// The first argument ends up passed as context (a.k.a. `this`).
// so `applyCall(f, [1, 2, 3])` is equivalent to `f.call(1, 2, 3)`
// The first argument passed as context is usually ignored in this 
// library. Mind melting ES5 alternative to `f(...args)` in
// the body of a function with args like this:
// (x, ...args) => {/* ... */}
export const applyCall = map.apply.bind(map.call)
