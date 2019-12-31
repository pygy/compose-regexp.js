import {diff, inter, flagOp, gatherFlags, union} from './_flag-algebra.js'
import {applyCall} from './_util.js'

export {
    add,
    keep,
    remove
}

// the actual operation is passed as `this`.
function exec(flags) {
    return new RegExp(
        applyCall(_sequence, arguments),
        flagOp(this, applyCall(gatherFlags, arguments), flags)
    )
}

function add(flags) {
    return arguments.length === 1
    ? exec.bind(union, flags)
    : exec.apply(union, arguments)
}

function remove(flags) {
    return arguments.length === 1
    ? _unflags.bind(diff, flags)
    : _unflags.apply(diff, arguments)
}

function keep(flags) {
    return arguments.length === 1
    ? _unflags.bind(inter, flags)
    : _unflags.apply(inter, arguments)
}
