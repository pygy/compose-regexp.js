import {currentFlags} from './_flag-helpers.js'
import {supportsUnicode} from './_util.js'

export { isAtomic, normalize, normalizeForSequence, normalizer, validSuffix, astralAtomic, legacyAtomic, gatherMetaData}


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

// const astralAtomic = supportsUnicode && flags('u',
//     /^/,
//     either(
//         sequence('\\u{',/[0-9A-Fa-f]+/,'}'),
//         /\\?[^]/
//     ),
//     /$/
// )
const astralAtomic = supportsUnicode && new RegExp(
  '^(?:\\\\u\\{[0-9A-Fa-f]+\\}|\\\\?[^])$',
  'u'
)

// const zeroplus = suffix('*')
// const legacyAtomic = sequence(
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
//     // Removed from now because that causes exponential backtracking in some cases
//     // see https://bugs.chromium.org/p/v8/issues/detail?id=9892#c9
//     // sequence(
//     //   '[',
//     //  zeroplus(either(
//     //    /\\[^]/,
//     //    /[^\]]/
//     //  )),
//     //  ']'
//     // )
//   ),
//   /$/
// )
const legacyAtomic = /^(?:\\(?:x[0-9A-Fa-f]{0,2}|[^]))$/
const normalizer = /[.?*+^$[\\(){|]/g
function normalize (input) {
  if (input instanceof RegExp) return input.source
  else return String(input).replace(normalizer, "\\$&")
}

// TODO investigate -] in charSets for isSequential and normalizeForSequence
const tokenMatcher = /(\\[^])|\[\-|[-()|\[\]]/g

// When composing expressions into a sequence, regexps that have a top-level
// choice operator must be wrapped in a non-capturing group. This function
// detects whether the group is needed or not.
export function hasTopLevelChoice (source) {
  if (source.indexOf('|') === -1) return false
  let depth = 0, inCharSet = false, match
  tokenMatcher.lastIndex = 0
  while(match = tokenMatcher.exec(source)) {
    // this branch may not be needed TODO: add test for the scenario and verify
    if (match[1] != null) continue
    if (!inCharSet && match[0] === '(') depth++
    if (!inCharSet && match[0] === ')') depth--
    if (!inCharSet && (match[0] === '[' || match[0] === '[-')) inCharSet = true
    if (inCharSet && match[0] === ']') inCharSet = false
    if (depth === 0 && !inCharSet && match[0] === '|') return true
  }
  return false
}

function normalizeForSequence (source) {
  source = normalize(source)
  return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
}

// helper function for isAtomic
export function isOneGroup (source) {
  // quick check to avoid parsing patters that can't be one group
  if (source.charAt(0) !== '(' || source.charAt(source.length - 1) !== ')') return false
  let depth = 0, inCharSet = false, match
  tokenMatcher.lastIndex = 0
  while(match = tokenMatcher.exec(source)) {
    // this branch may not be needed TODO: add test for the scenario and verify
    if (match[1] != null) {
      // the last parentese is actually an escape sequence
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

const charSetTokens = /(])|\\?./g
function isOneCharSet(x) {
    if (x[0] !== '[') return false
    charSetTokens.lastIndex = 1
    let res
    while(res = charSetTokens.exec(x)) {
        if (res[1] != null) return res.index === x.length - 1
    }
}

function gatherMetaData(source) {
  return {
    atomic: isAtomic(source),
    topLevelChoice: hasTopLevelChoice(source)
  }
}

// Determine if a pattern can take a suffix operator or if a non-capturing group
// is needed around it.
// We can safely have false negatives (consequence: useless non-capturing groups)
// whereas false positives would be bugs. We do ahve some false positives:
// some charsets will be marked as non-atomic.
function isAtomic (source) {
  return source.length === 1
  || currentFlags.u && astralAtomic.test(source)
  || legacyAtomic.test(source)
  || isOneCharSet(source)
  || isOneGroup(source)
}
