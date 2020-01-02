import {currentFlags} from './_flag-helpers.js'
export { isAtomic, normalize, normalizeForSequence, validSuffix }

// const maybe = suffix('?')
// const validSuffix = sequence(
//     /^/,
//     either(
//         '+', '*', '?',
//         sequence(
//             '{',
//             capture(/\d+/),
//             maybe(
//                 ',',
//                  maybe(capture(/\d+/))
//             ),
//             '}'
//         ),
//     ),
//     maybe('?'),
//     /$/
// )
const validSuffix = /^(?:\+|\*|\?|\{(\d+)(?:,(\d+)?)?\})\??$/

// const atomicUnicode = 'unicode' in RegExp.prototype && flags('u', 
//     /^/,
//     either(
//         sequence('\\u{',/[0-9A-Fa-f]+/,'}'),
//         /\\?[^]/
//     ),
//     /$/
// )
const atomicUnicode = 'unicode' in RegExp.prototype 
    && new RegExp('^(?:\\\\u\\{[0-9A-Fa-f]+\\}|\\\\?[^])$', 'u')

// const zeroplus = suffix('*')
// const atomicAscii = sequence(
//   /^/,
//   either(
//     sequence( // Escape sequences
//       '\\',
//       either(
//         /x[0-9A-Fa-f]{0,2}/,
//         /[^]/
//       )
//     ),
//     // Character sets; know to have been validated by the
//     // RegExp constructor, so relaxed parsing is OK.
//     sequence(  
//       '[',
//       zeroplus(either(
//         /\\[^]/,
//         /[^\]]/
//       )), 
//       ']'
//     )
//   ),
//   /$/
// )
const atomicAscii = /^(?:\\(?:x[0-9A-Fa-f]{0,2}|[^])|\[(?:\\[^]|[^\]])*\])$/

function normalize (input) {
    if (input instanceof RegExp) return input.source
    else return String(input).replace(/[.?*+^$[\\(){|]/g, "\\$&")
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

function normalizeForSequence(source) {
    source = normalize(source)
    return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
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

// Determine if a pattern can take a suffix operator or if a non-capturing group
// is needed around it.
// We can safely have false negatives (consequence: useless non-capturing groups)
// whereas false positives would be bugs. We do ahve some false positives:
// some charsets will be marked as non-atomic.
function isAtomic(source) {
    return source.length === 1 
    || (atomicUnicode && currentFlags.u && atomicUnicode.test(source)) 
    || atomicAscii.test(source)
    || isOneGroup(source)
}
