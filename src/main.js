
import * as C from './_core.js'
import {applyCall, hasOwn} from './_util.js'

import {either} from './_core.js'

export {
    avoid, capture, createScopedCapture, either, flags,
    group, lookAhead, ref, sequence, suffix
}

const empty = new RegExp('')

function sequence () {
    return new RegExp(C.sequenceHelper.apply(null, arguments), C.getUnionFlag())
}

const validSuffix = sequence(
    /^/,
    either(
        '+', '*', '?',
        /\{\s*\d+(?:\s*,\s*)?\d*\s*\}/
    ),
    /\??$/
)

function suffix(suffix) {
    if (!validSuffix.test(suffix)) throw new Error(`Invalid suffix '${suffix}'.`)
    return (arguments.length === 1)
        ? C.suffix.bind(null, suffix)
        : C.suffix.apply(null, arguments)
}

export function ref(n) {
    if (!/^\d$/.test(String(n))) throw new Error (`Invalid back reference: ${JSON.stringify(n)}`)
    return new RegExp('\\' + n)
}

export function lookAhead() {
    if (!arguments.length) return empty;
    return new RegExp('(?=' + C.sequenceHelper.apply(null, arguments) + ')', C.getUnionFlag())
}

export function avoid() {
    if (!arguments.length) return empty;
    return new RegExp('(?!' + C.sequenceHelper.apply(null, arguments) + ')', C.getUnionFlag())
}

export const group = C.suffix.bind(null, '')

export function flags(opts) {
    return arguments.length === 1
    ? C.flags.bind(null, opts)
    : C.flags.apply(null, arguments)
}

export function capture() {
    return new RegExp('(' + C.sequenceHelper.apply(null, arguments) + ')', C.getUnionFlag())
}

function createScopedCapture(ns = {}) {
    let i = 1;
    let anonCount = 0
    function capture(name) {
        if (hasOwn.call(ns, name)) throw new RangeError(`Attempt to redefine ${name}`)
        ns[name] = i++
        i += anonCount
        anonCount = 0
        return applyCall(coreCapture, arguments)
    }
    function nestedAnon() {
        anonCount++
        return capture.apply(null, arguments)
    }
    return {ns, capture, nestedAnon}
}
