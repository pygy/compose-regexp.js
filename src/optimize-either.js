import { astralAtomic, legacyAtomic, normalizer } from './_parsers.js'
import { currentFlags } from './_flag-helpers.js'
import { supportsUnicode } from './_util.js'

export { optimizeEither }

// TODO: parse char sets. Beware of negative sets.
const optimizableAscii = /^.$/
const optimizableUnicode = supportsUnicode && new RegExp(
  '^.$',
  'u'
)
function optimizable (x) {
  // no need to check for supportsUnicode here. the currentFlags are extracted
  // from actual regexps, so the 'u' flag can't be set if there's no support
  return x instanceof CharSet || (
    currentFlags.u ? optimizableUnicode : optimizableAscii
  ).test(x)
}

// TODO: also match ranges that start with an escape sequence.
const legacySplitter = /.-.|\\.|./
const astralSplitter = supportsUnicode && new RegExp('', 'iu')

// TODO: add \u... and \x... and \u{...}
const isLegacyEscape = /\\./
const isAstralEscape = supportsUnicode && new RegExp('\\.', 'u')

function extractHexEscape (x) {
   return parseInt(x.match(/[0-9A-Za-z]+/g)[0], 16)
}

function toCodePoint (x, ops) {
  if (currentFlags.u && /^\\[ux]/i.test(x)) return extractHexEscape(x)
  if (x == null) console.trace()
  return ops.toNum(x, (x[0] === '\\' ? 1 : 0))
}

function interval (x, ops) {
  if (x.length === 1 || ops.isOneChar.test(x)) {
    const from = toCodePoint(x, ops)
    return [from, from + 1]
  } else {
    if (ops.splitter.lastIndex !== 0) {
      console.warn("splitter.lastIndex should be 0 at this point", { x })
      console.trace()
      ops.splitter.lastIndex = 0
    }
    const [, from, to] = ops.splitter.exec(x)
    ops.splitter.lastIndex = 0
    return [toCodePoint(from, ops), toCodePoint(to, ops) + 1]
  }
}
// pass the array and index rather than
// the value so that we can bound check
// before indexing, helping the compiler
// optimize the rest of the function.
function overlap (acc, ary, i) {
  if (i >= ary.length) return false
  const other = ary[i]
  if (acc[0] <= other[1] && other[0] <= acc[1]) {
    acc[0] = Math.min(acc[0], other[0])
    acc[1] = Math.max(acc[1], other[1])
    return true
  }
  return false
}
const astralOps = {
  isOneChar: astralAtomic,
  isEscape: isAstralEscape,
  splitter: astralSplitter,
  toNum: (x, i) => x.codePointAt(i)
}
const legacyOps = {
  isOneChar: legacyAtomic,
  isEscape: isLegacyEscape,
  splitter: legacySplitter,
  toNum: (x, i) => x.charCodeAt(i)
}
// `src` is either a valid charset, coming from the source of
// a RegExp (thus validated) or a single character or escape
// sequence
function CharSet (src) {
  this.intervals = []
  const ops = currentFlags.u ? astralOps : legacyOps

  if (src[0] != '[') this.intervals.push(interval(src, ops))
  else {
    const ranges = src.slice(1, -1).match(ops.splitter).sort()
    ranges.forEach(x => interval(x, ops))
    this.add(ranges)
  }
}
// TODO: make sure there are no pathological cases
// that would let one DOS the lib by having `.add()`
// go quadratic (O(m*n), really). I expect it to be
// O( m + log(n)*n) ), most of the time taking into
// account that the new charset must be sorted.
CharSet.prototype.add = function(other) {
  // the local set is already optimized.
  const local = this.intervals
  const otherIsOptimized = local.length > 0
  // other is guaranteed to have at least one char
  // whereas local will be empty when the CharSet
  // is created
  let acc = other[0]
  if (otherIsOptimized && local[0][0] < acc[0]) acc = local[0]
  const result = [acc]
  let l = 0, o = 0
  if (acc === other[0]) o++; else l++
  const done = () => l === local.length && o === other.length
  const doneLocal = () => l === local.length
  const doneOther = () => o === other.length
  while (!done()) {
    while(!done()) {
      const l_ = l, o_ = o
      while (overlap(acc, local, l)) l++
      while (overlap(acc, other, o)) o++
      if (o_ === o && l_ === l) break
    }
    if (!done()) {
      if (doneOther()) {
        // local is already optimized, just push it.
        do {result.push(local[l++])} while(!doneLocal())
      } else {
        if (otherIsOptimized && doneLocal()) {
          // other has already gone through this once, it isn't
          // an internal call, so it is optimized and can be pushed
          // wholesale
          do {result.push(other[o++])} while (!doneOther())
        }
        else if (!doneLocal() && local[l][0] < other[o][0] ) {
          result.push(acc = local[l++])
        } else {
          result.push(acc = other[o++])
        }
      }
    }
  }
  this.intervals = result
  // console.log(this.intervals)
}

function escapeCharSet(cs) {
  return cs.replace(/[\]\-]/, '\\$&')
}

CharSet.prototype.toString = function() {
  const toString = supportsUnicode ? String.fromCodePoint : String.fromCharCode
  if (this.intervals.length === 1) {
    const first = this.intervals[0]
    if (first[0] + 1 === first[1]) return toString(first[0]).replace(normalizer, '\\$&')
  }
  return '[' + this.intervals.reduce((acc, r) =>{
    if (r[0] + 1 === r[1]) acc.push(toString(r[0]).replace(/[\]\-]/, '\\$&'))
    else acc.push(
      escapeCharSet(toString(r[0])),
      (r[0] + 2 === r[1]) ? '' : '-',
      escapeCharSet(toString(r[1] - 1))
    )
    return acc
  }, []).join('') + ']'
}

function optimizeEither (sources) {
  return sources.reduce(function (acc, value) {
    const opt = optimizable(value)
    if (opt) value = new CharSet(value)
    if (acc.length === 0 || !opt) acc.push(value)
    else {
      const last = acc[acc.length - 1]
      if (last instanceof CharSet) last.add(value.intervals)
      else acc.push(value)
    }
    return acc
  }, [])
}
