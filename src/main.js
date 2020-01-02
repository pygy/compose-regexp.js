import { compileFlags, gatherFlags, parseFlags, union, currentFlags } from './_flag-helpers.js'
import { isAtomic, normalize, normalizeForSequence, validSuffix } from './_parsers.js'
import { empty, hasOwn, map } from './_util.js'

// dep for FlagOps
export { sequenceHelper }
// Public API
export { avoid, capture, createPseudoNamedCapture, either, flags, group, lookAhead, ref, sequence, suffix }

function keepUnicode() {
    return currentFlags.u ? 'u' : ''
}

function sequenceHelper(...args) {
    gatherFlags(...args)
    if (args.length === 0) return ''
    if (args.length === 1) return normalize(args[0])
    return args.map(normalizeForSequence).join('')
}

function suffixHelper(operator, ...args) {
    if (args.length === 0) return empty
    const res = sequenceHelper(...args)
    return new RegExp(
        isAtomic(res) ? res + operator : '(?:' + res + ')' + operator,
        keepUnicode()
    )
}

const uTrue = {u: true}
const emptySet = {}
function flagsHelper(opts, ...args) {
    return new RegExp(
        sequenceHelper(...args),
        compileFlags(union(parseFlags(opts), currentFlags.u ? uTrue : emptySet))
    )
}

function avoid(...args) {
    if (args.length === 0) return empty
    return new RegExp('(?!' + sequenceHelper(...args) + ')', keepUnicode())
}

function capture(...args) {
    return new RegExp('(' + sequenceHelper(...args) + ')', keepUnicode())
}

function createPseudoNamedCapture() {
    const names = {}
    let i = 0
    let anonCount = 0
    function cap(name, ...args) {
        if (hasOwn.call(names, name)) throw new Error(`Attempt to redefine ${name}`)
        names[name] = ++i
        i += anonCount
        anonCount = 0
        return capture(...args)
    }
    function nestedAnon(...args) {
        anonCount++
        return capture(...args)
    }
    return {names, capture: cap, nestedAnon}
}

function either(...args) {
    gatherFlags(...args)
    return new RegExp(args.map(normalize).join('|'), keepUnicode())
}

// Let the RegExp constructor handle flags validation
// so that partially applied functions can be created
// without worrying about compatibility.
function flags(opts, ...args) {
    return args.length === 0
        ? flagsHelper.bind(null, opts)
        : flagsHelper(opts, ...args)
}

const group = suffixHelper.bind(null, '')

function lookAhead(...args) {
    if (args.length === 0) return empty
    return new RegExp('(?=' + sequenceHelper(...args) + ')', keepUnicode())
}

function ref(n) {
    if (!/^\d$/.test(String(n))) throw new Error (`Invalid back reference: ${JSON.stringify(n)}`)
    return new RegExp('\\' + n)
}

function sequence(...args) {
    return new RegExp(sequenceHelper(...args), keepUnicode())
}

function suffix(suffix, ...args) {
    const m = validSuffix.exec(suffix)
    if (m == null) throw new SyntaxError(`Invalid suffix '${suffix}'.`)
    if (m[1] != null && m[2] != null && Number(m[1]) > Number(m[2])) {
        throw new SyntaxError(`numbers out of order in ${suffix} quantifier.`)
    }
    return (args.length === 0)
        ? suffixHelper.bind(null, suffix)
        : suffixHelper(suffix, ...args)
}
