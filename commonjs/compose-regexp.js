(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('compose-regexp', ['exports'], factory) :
  (factory((global.composeRegexp = {})));
}(this, function (exports) { 'use strict';

  var empty = new RegExp('')
  var hasOwn = ({}).hasOwnProperty
  var map = [].map
  var supportsUnicode = 'unicode' in RegExp.prototype

  // parse/compile
  // -------------

  function parseFlags (f) {
    if (f == null) {console.trace();return {}}
    return f.split('').reduce(function (acc, f) {
      return (acc[f] = true, acc)
    }, Object.create(null))
  }

  function compileFlags (fl) {
    return Object.keys(fl).filter(function (f) { return fl[f]; }).join('')
  }

  // collect the current flags
  // Rely on the fact that the combinators are not reentrant and store the common
  // flags in the root scope.
  var currentFlags = {}

  function gatherFlags () {
    currentFlags = map.call(
      arguments,
      // input can actually be a non-regexp hence the `|| ''`
      function (input) { return parseFlags(input.flags || ''); }
    )
    .reduce(union, {})
  }

  // set operations
  // --------------

  function union (a, b) {
    return Object.assign(a, b)
  }

  function inter (a, b) {
    Object.keys(a).forEach(function (f) {if (!b[f]) { delete a[f] }})
    return a
  }

  function diff (a, b) {
    Object.keys(a).forEach(function (f) {if (b[f]) { delete a[f] }})
    return a
  }

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
  var validSuffix = /^(?:\+|\*|\?|\{(\d+)(?:,(\d+)?)?\})\??$/

  // const astralAtomic = supportsUnicode && flags('u',
  //     /^/,
  //     either(
  //         sequence('\\u{',/[0-9A-Fa-f]+/,'}'),
  //         /\\?[^]/
  //     ),
  //     /$/
  // )
  var astralAtomic = supportsUnicode && new RegExp(
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
  var legacyAtomic = /^(?:\\(?:x[0-9A-Fa-f]{0,2}|[^]))$/
  var normalizer = /[.?*+^$[\\(){|]/g
  function normalize (input) {
    if (input instanceof RegExp) { return input.source }
    else { return String(input).replace(normalizer, "\\$&") }
  }

  // TODO investigate -] in charSets for isSequential and normalizeForSequence
  var tokenMatcher = /(\\[^])|\[\-|[-()|\[\]]/g

  // When composing expressions into a sequence, regexps that have a top-level
  // choice operator must be wrapped in a non-capturing group. This function
  // detects whether the group is needed or not.
  function hasTopLevelChoice (source) {
    if (source.indexOf('|') === -1) { return false }
    var depth = 0, inCharSet = false, match
    tokenMatcher.lastIndex = 0
    while(match = tokenMatcher.exec(source)) {
      // this branch may not be needed TODO: add test for the scenario and verify
      if (match[1] != null) { continue }
      if (!inCharSet && match[0] === '(') { depth++ }
      if (!inCharSet && match[0] === ')') { depth-- }
      if (!inCharSet && (match[0] === '[' || match[0] === '[-')) { inCharSet = true }
      if (inCharSet && match[0] === ']') { inCharSet = false }
      if (depth === 0 && !inCharSet && match[0] === '|') { return true }
    }
    return false
  }

  function normalizeForSequence (source) {
    source = normalize(source)
    return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
  }

  // helper function for isAtomic
  function isOneGroup (source) {
    // quick check to avoid parsing patters that can't be one group
    if (source.charAt(0) !== '(' || source.charAt(source.length - 1) !== ')') { return false }
    var depth = 0, inCharSet = false, match
    tokenMatcher.lastIndex = 0
    while(match = tokenMatcher.exec(source)) {
      // this branch may not be needed TODO: add test for the scenario and verify
      if (match[1] != null) {
        // the last parentese is actually an escape sequence
        if (match.index === source.length - 2) { return false }
        continue
      }
      if (!inCharSet && match[0] === '(') { depth++ }
      if (!inCharSet && match[0] === ')') {
        depth--
        if (depth === 0 && match.index !== source.length - 1) { return false }
      }
      if (!inCharSet && (match[0] === '[' || match === '[-')) { inCharSet = true }
      if (inCharSet && match[0] === ']') { inCharSet = false }
    }
    return true
  }

  var charSetTokens = /(])|\\?./g
  function isOneCharSet(x) {
      if (x[0] !== '[') { return false }
      charSetTokens.lastIndex = 1
      var res
      while(res = charSetTokens.exec(x)) {
          if (res[1] != null) { return res.index === x.length - 1 }
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

  // TODO: parse char sets. Beware of negative sets.
  var optimizableAscii = /^.$/
  var optimizableUnicode = supportsUnicode && new RegExp(
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
  var legacySplitter = /.-.|\\.|./
  var astralSplitter = supportsUnicode && new RegExp('', 'iu')

  // TODO: add \u... and \x... and \u{...}
  var isLegacyEscape = /\\./
  var isAstralEscape = supportsUnicode && new RegExp('\\.', 'u')

  function extractHexEscape (x) {
     return parseInt(x.match(/[0-9A-Za-z]+/g)[0], 16)
  }

  function toCodePoint (x, ops) {
    if (currentFlags.u && /^\\[ux]/i.test(x)) { return extractHexEscape(x) }
    if (x == null) { console.trace() }
    return ops.toNum(x, (x[0] === '\\' ? 1 : 0))
  }

  function interval (x, ops) {
    if (x.length === 1 || ops.isOneChar.test(x)) {
      var from = toCodePoint(x, ops)
      return [from, from + 1]
    } else {
      if (ops.splitter.lastIndex !== 0) {
        console.warn("splitter.lastIndex should be 0 at this point", { x: x })
        console.trace()
        ops.splitter.lastIndex = 0
      }
      var ref = ops.splitter.exec(x);
      var from$1 = ref[1];
      var to = ref[2];
      ops.splitter.lastIndex = 0
      return [toCodePoint(from$1, ops), toCodePoint(to, ops) + 1]
    }
  }
  // pass the array and index rather than
  // the value so that we can bound check
  // before indexing, helping the compiler
  // optimize the rest of the function.
  function overlap (acc, ary, i) {
    if (i >= ary.length) { return false }
    var other = ary[i]
    if (acc[0] <= other[1] && other[0] <= acc[1]) {
      acc[0] = Math.min(acc[0], other[0])
      acc[1] = Math.max(acc[1], other[1])
      return true
    }
    return false
  }
  var astralOps = {
    isOneChar: astralAtomic,
    isEscape: isAstralEscape,
    splitter: astralSplitter,
    toNum: function (x, i) { return x.codePointAt(i); }
  }
  var legacyOps = {
    isOneChar: legacyAtomic,
    isEscape: isLegacyEscape,
    splitter: legacySplitter,
    toNum: function (x, i) { return x.charCodeAt(i); }
  }
  // `src` is either a valid charset, coming from the source of
  // a RegExp (thus validated) or a single character or escape
  // sequence
  function CharSet (src) {
    this.intervals = []
    var ops = currentFlags.u ? astralOps : legacyOps

    if (src[0] != '[') { this.intervals.push(interval(src, ops)) }
    else {
      var ranges = src.slice(1, -1).match(ops.splitter).sort()
      ranges.forEach(function (x) { return interval(x, ops); })
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
    var local = this.intervals
    var otherIsOptimized = local.length > 0
    // other is guaranteed to have at least one char
    // whereas local will be empty when the CharSet
    // is created
    var acc = other[0]
    if (otherIsOptimized && local[0][0] < acc[0]) { acc = local[0] }
    var result = [acc]
    var l = 0, o = 0
    if (acc === other[0]) { o++; } else { l++ }
    var done = function () { return l === local.length && o === other.length; }
    var doneLocal = function () { return l === local.length; }
    var doneOther = function () { return o === other.length; }
    while (!done()) {
      while(!done()) {
        var l_ = l, o_ = o
        while (overlap(acc, local, l)) { l++ }
        while (overlap(acc, other, o)) { o++ }
        if (o_ === o && l_ === l) { break }
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
    var toString = supportsUnicode ? String.fromCodePoint : String.fromCharCode
    if (this.intervals.length === 1) {
      var first = this.intervals[0]
      if (first[0] + 1 === first[1]) { return toString(first[0]).replace(normalizer, '\\$&') }
    }
    return '[' + this.intervals.reduce(function (acc, r) {
      if (r[0] + 1 === r[1]) { acc.push(toString(r[0]).replace(/[\]\-]/, '\\$&')) }
      else { acc.push(
        escapeCharSet(toString(r[0])),
        (r[0] + 2 === r[1]) ? '' : '-',
        escapeCharSet(toString(r[1] - 1))
      ) }
      return acc
    }, []).join('') + ']'
  }

  function optimizeEither (sources) {
    return sources.reduce(function (acc, value) {
      var opt = optimizable(value)
      if (opt) { value = new CharSet(value) }
      if (acc.length === 0 || !opt) { acc.push(value) }
      else {
        var last = acc[acc.length - 1]
        if (last instanceof CharSet) { last.add(value.intervals) }
        else { acc.push(value) }
      }
      return acc
    }, [])
  }

  function keepUnicode () {
    return currentFlags.u ? 'u' : ''
  }

  function sequenceHelper () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    gatherFlags.apply(void 0, args)
    if (args.length === 0) { return '' }
    if (args.length === 1) { return normalize(args[0]) }
    return args.map(normalizeForSequence).join('')
  }

  function avoid () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    if (args.length === 0) { return empty }
    return new RegExp('(?!' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
  }

  function capture () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return new RegExp('(' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
  }

  function either () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    gatherFlags.apply(void 0, args)
    return new RegExp(optimizeEither(args.map(normalize)).join('|'), keepUnicode())
  }

  var uTrue = {u: true}
  var emptySet = {}
  function flagsHelper (opts) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    return new RegExp(
      sequenceHelper.apply(void 0, args),
      compileFlags(union(parseFlags(opts), currentFlags.u ? uTrue : emptySet))
    )
  }
  // Let the RegExp constructor handle flags validation
  // so that partially applied functions can be created
  // without worrying about compatibility.
  function flags (opts) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    return args.length === 0
      ? flagsHelper.bind(null, opts)
      : flagsHelper.apply(void 0, [ opts ].concat( args ))
  }

  var group = suffixHelper.bind(null, '')

  function lookAhead () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    if (args.length === 0) { return empty }
    return new RegExp('(?=' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
  }

  function ref (n) {
    if (!/^\d$/.test(String(n))) { throw new Error (("Invalid back reference: " + (JSON.stringify(n)))) }
    return new RegExp('\\' + n)
  }

  function sequence () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return new RegExp(sequenceHelper.apply(void 0, args), keepUnicode())
  }

  function suffixHelper (operator) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    if (args.length === 0) { return empty }
    var res = sequenceHelper.apply(void 0, args)
    return new RegExp(
      gatherMetaData(res).atomic ? res + operator : '(?:' + res + ')' + operator,
      keepUnicode()
    )
  }
  function suffix (suffix) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    var m = validSuffix.exec(suffix)
    if (m == null) { throw new SyntaxError(("Invalid suffix '" + suffix + "'.")) }
    if (m[1] != null && m[2] != null && Number(m[1]) > Number(m[2])) {
      throw new SyntaxError(("numbers out of order in " + suffix + " quantifier."))
    }
    return (args.length === 0)
      ? suffixHelper.bind(null, suffix)
      : suffixHelper.apply(void 0, [ suffix ].concat( args ))
  }


  // name a few common suffixes

  var maybe = suffix('?')
  var zeroPlus = suffix('*')
  var onepPlus = suffix('+')

  // Named captures



  function makeNames() {
    if (typeof Proxy != 'undefined') { return new Proxy(Object.create(null), {
      get: function get(target, property) {
        if (!(property in target)) { throw new Error(("Can't access undefined property ." + property)) }
        return target.property
      },
      set: function set(target, property, value) {
        if (property in target) { throw new Error(("Attempt to redefine property ." + property)) }
        return target[property] = value
      }
    }) } 
    else { return {} }
  }

  function createPseudoNamedCapture () {
    var names = makeNames()
    var i = 0
    var anonCount = 0
    function cap (name) {
      var args = [], len = arguments.length - 1;
      while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

      if (hasOwn.call(names, name)) { throw new Error(("Attempt to redefine " + name)) }
      names[name] = ++i
      i += anonCount
      anonCount = 0
      return capture.apply(void 0, args)
    }
    function nestedAnon () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      anonCount++
      return capture.apply(void 0, args)
    }
    function nextI() {return i + 1}
    return {names: names, capture: cap, nestedAnon: nestedAnon, nextI: nextI}
  }

  // the actual operation is passed as `this`.
  function exec (flags) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    var src = sequenceHelper.apply(void 0, args)
    return new RegExp(
      src,
      compileFlags(this(currentFlags, flags))
    )
  }

  function op (flags) {
    var args = [], len = arguments.length - 1;
    while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

    var parsed = typeof flags === 'string' ? parseFlags(flags) : flags
    return args.length === 0
      ? exec.bind(this, parsed)
      : exec.call.apply(exec, [ this, parsed ].concat( args ))
  }

  var add = op.bind(union)
  var remove = op.bind(diff)
  var keep = op.bind(inter)


  var flagOps = Object.freeze({
    add: add,
    keep: keep,
    remove: remove
  });

  exports.flagOps = flagOps;
  exports.avoid = avoid;
  exports.capture = capture;
  exports.createPseudoNamedCapture = createPseudoNamedCapture;
  exports.either = either;
  exports.flags = flags;
  exports.group = group;
  exports.lookAhead = lookAhead;
  exports.ref = ref;
  exports.sequence = sequence;
  exports.suffix = suffix;

}));
