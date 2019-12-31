import {gatherFlags, flagOp, inter, union} from './_flag-algebra.js'
import {applyCall, empty, map} from './_util.js'

export {
    applyCall, sequenceHelper, either, getUnionFlag,
    isAtomic, suffix, flags
}

const atomicU = 'unicode' in RegExp.prototype && new RegExp('^(?:\\\\u\{[0-9A-Fa-f]+\}|\\\\?[^])$', 'u')

function normalize (source) {
    if (source instanceof RegExp) return source.source
    else return (source+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&")
}

// TODO investigate -] in charSets for isSequential and normalizeForSequence
const tokenMatcher = /(\\[^])|\[\-|[-()|\[\]]/g

// When composing expressions into a sequence, regexps that have a top-level
// choice operator must be wrapped in a non-capturing group. This function
// detects whether the group is needed or not.
export function hasTopLevelChoice(source) {
    if (source.indexOf('|') === -1) return false
    let depth = 0, inCharSet = false, match
    tokenMatcher.lastIndex = 0
    while(match = tokenMatcher.exec(source)) {
        if (match[1] != null) continue
        if (!inCharSet && match[0] === '(') depth++
        if (!inCharSet && match[0] === ')') depth--
        if (!inCharSet && (match[0] === '[' || match[0] === '[-')) inCharSet = true
        if (inCharSet && match[0] === ']') inCharSet = false
        if (depth === 0 && !inCharSet && match[0] === '|') return true
    }
    return false
}

// helper function for isAtomic
export function isOneGroup(source) {
    if (source.charAt(0) !== '(' || source.charAt(source.length - 1) !== ')') return false
    let depth = 0, inCharSet = false, match
    tokenMatcher.lastIndex = 0
    while(match = tokenMatcher.exec(source)) {
        if (match[1] != null) {
            if (match.index === source.length - 2) return false
            continue
        }
        if (!inCharSet && match[0] === '(') depth++
        if (!inCharSet && match[0] === ')') {
            depth--
            if (depth === 0 && match.index !== source.length - 1) return false
        }
        if (!inCharSet && (match[0] === '[' || match === '[-')) inCharSet = true
        if (inCharSet && match[0] === ']') inCharSet = false
    }
    return true
}

function normalizeForSequence(source) {
    source = normalize(source)
    return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
}

// Determine if a pattern can take a suffix operator or if a non-capturing group
// is needed around it.
// We can safely have false negatives (consequence: useless non-capturing groups)
// whereas false positives would be bugs. We do ahve some false positives:
// some charsets will be marked as non-atomic.
function isAtomic(source) {
    return source.length === 1 
    || (atomicU != null && currentFlags.includes('u') && atomicU.test(source)) 
    || /^\\[^]$|^\[(?:\\[^]|[^\]])*\]$/.test(source) 
    || isOneGroup(source)
}

// Rely on the fact that the combinators are not reentrant
// and store the common flags in the parent scope.
// Every core API end point must use keepUnionFlag
// instead of the bare RegExp constructor.
let currentFlags;
function getUnionFlag() {
    return flagOp(inter, currentFlags, 'u')
}

function sequenceHelper() {
    currentFlags = gatherFlags.apply(null, arguments)
    if (arguments.length === 0) return '';
    if (arguments.length === 1) return normalize(arguments[0])
    return map.call(arguments, normalizeForSequence).join('')
}

function suffix(operator) {
    if (arguments.length === 1) return empty
    const res = applyCall(sequenceHelper, arguments)
    return new RegExp(isAtomic(res) ? res + operator : '(?:' + res + ')' + operator, getUnionFlag())
}

function flags(opts) {
    return new RegExp(
        applyCall(sequenceHelper, arguments),
        flagOp(union, opts, getUnionFlag())
    )
}

// Actually part of the public API, placed here for convenience
function either() {
    currentFlags = gatherFlags.apply(null, arguments)
    return new RegExp(map.call(arguments, normalize).join('|'), getUnionFlag())
}
