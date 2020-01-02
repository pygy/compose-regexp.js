import { compileFlags, currentFlags, diff, inter, parseFlags, union } from './_flag-helpers.js'
import { sequenceHelper } from './main.js'

export { add, keep, remove }

// the actual operation is passed as `this`.
function exec(flags, ...args) {
    const src = sequenceHelper(...args)
    return new RegExp(
        src,
        compileFlags(this(currentFlags, flags))
    )
}

function op(flags, ...args) {
    const parsed = typeof flags === 'string' ? parseFlags(flags) : flags
    return args.length === 0
        ? exec.bind(this, parsed)
        : exec.call(this, parsed, ...args)
}

const add = op.bind(union)
const remove = op.bind(diff)
const keep = op.bind(inter)
