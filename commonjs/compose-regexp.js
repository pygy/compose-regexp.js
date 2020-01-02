(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define('compose-regexp', ['exports'], factory) :
    (factory((global.composeRegexp = {})));
}(this, function (exports) { 'use strict';

    var empty = new RegExp('')
    var hasOwn = ({}).hasOwnProperty
    var map = [].map

    // parse/compile
    // -------------

    function parseFlags(f) {
        if (f == null) {console.trace();return {}}
        return f.split('').reduce(function (acc, f) {
            return (acc[f] = true, acc)
        }, Object.create(null))
    }

    function compileFlags(fl) {
        return Object.keys(fl).join('')
    }

    // collect the current flags
    // Rely on the fact that the combinators are not reentrant and store the common 
    // flags in the root scope.
    var currentFlags = {}

    function gatherFlags() {
        currentFlags = map.call(
                arguments,
                // input can actually be a non-regexp hence the `|| ''`
                function (input) { return parseFlags(input.flags || ''); }
            )
            .reduce(union, {})
    }

    // set operations
    // --------------

    function union(a, b) {
        return Object.assign(a, b)
    }

    function inter(a, b) {
        Object.keys(a).forEach(function (f) {if (!b[f]) { delete a[f] }})
        return a
    }

    function diff(a, b) {
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

    // const atomicUnicode = 'unicode' in RegExp.prototype && flags('u', 
    //     /^/,
    //     either(
    //         sequence('\\u{',/[0-9A-Fa-f]+/,'}'),
    //         /\\?[^]/
    //     ),
    //     /$/
    // )
    var atomicUnicode = 'unicode' in RegExp.prototype 
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
    var atomicAscii = /^(?:\\(?:x[0-9A-Fa-f]{0,2}|[^])|\[(?:\\[^]|[^\]])*\])$/

    function normalize (input) {
        if (input instanceof RegExp) { return input.source }
        else { return String(input).replace(/[.?*+^$[\\(){|]/g, "\\$&") }
    }

    // TODO investigate -] in charSets for isSequential and normalizeForSequence
    var tokenMatcher = /(\\[^])|\[\-|[-()|\[\]]/g

    // When composing expressions into a sequence, regexps that have a top-level
    // choice operator must be wrapped in a non-capturing group. This function
    // detects whether the group is needed or not.
    function hasTopLevelChoice(source) {
        if (source.indexOf('|') === -1) { return false }
        var depth = 0, inCharSet = false, match
        tokenMatcher.lastIndex = 0
        while(match = tokenMatcher.exec(source)) {
            if (match[1] != null) { continue }
            if (!inCharSet && match[0] === '(') { depth++ }
            if (!inCharSet && match[0] === ')') { depth-- }
            if (!inCharSet && (match[0] === '[' || match[0] === '[-')) { inCharSet = true }
            if (inCharSet && match[0] === ']') { inCharSet = false }
            if (depth === 0 && !inCharSet && match[0] === '|') { return true }
        }
        return false
    }

    function normalizeForSequence(source) {
        source = normalize(source)
        return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
    }

    // helper function for isAtomic
    function isOneGroup(source) {
        if (source.charAt(0) !== '(' || source.charAt(source.length - 1) !== ')') { return false }
        var depth = 0, inCharSet = false, match
        tokenMatcher.lastIndex = 0
        while(match = tokenMatcher.exec(source)) {
            if (match[1] != null) {
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

    function keepUnicode() {
        return currentFlags.u ? 'u' : ''
    }

    function sequenceHelper() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        gatherFlags.apply(void 0, args)
        if (args.length === 0) { return '' }
        if (args.length === 1) { return normalize(args[0]) }
        return args.map(normalizeForSequence).join('')
    }

    function suffixHelper(operator) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        if (args.length === 0) { return empty }
        var res = sequenceHelper.apply(void 0, args)
        return new RegExp(
            isAtomic(res) ? res + operator : '(?:' + res + ')' + operator,
            keepUnicode()
        )
    }

    var uTrue = {u: true}
    var emptySet = {}
    function flagsHelper(opts) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        return new RegExp(
            sequenceHelper.apply(void 0, args),
            compileFlags(union(parseFlags(opts), currentFlags.u ? uTrue : emptySet))
        )
    }

    function avoid() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        if (args.length === 0) { return empty }
        return new RegExp('(?!' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
    }

    function capture() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        return new RegExp('(' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
    }

    function createPseudoNamedCapture() {
        var names = {}
        var i = 0
        var anonCount = 0
        function cap(name) {
            var args = [], len = arguments.length - 1;
            while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

            if (hasOwn.call(names, name)) { throw new Error(("Attempt to redefine " + name)) }
            names[name] = ++i
            i += anonCount
            anonCount = 0
            return capture.apply(void 0, args)
        }
        function nestedAnon() {
            var args = [], len = arguments.length;
            while ( len-- ) args[ len ] = arguments[ len ];

            anonCount++
            return capture.apply(void 0, args)
        }
        return {names: names, capture: cap, nestedAnon: nestedAnon}
    }

    function either() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        gatherFlags.apply(void 0, args)
        return new RegExp(args.map(normalize).join('|'), keepUnicode())
    }

    // Let the RegExp constructor handle flags validation
    // so that partially applied functions can be created
    // without worrying about compatibility.
    function flags(opts) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        return args.length === 0
            ? flagsHelper.bind(null, opts)
            : flagsHelper.apply(void 0, [ opts ].concat( args ))
    }

    var group = suffixHelper.bind(null, '')

    function lookAhead() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        if (args.length === 0) { return empty }
        return new RegExp('(?=' + sequenceHelper.apply(void 0, args) + ')', keepUnicode())
    }

    function ref(n) {
        if (!/^\d$/.test(String(n))) { throw new Error (("Invalid back reference: " + (JSON.stringify(n)))) }
        return new RegExp('\\' + n)
    }

    function sequence() {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        return new RegExp(sequenceHelper.apply(void 0, args), keepUnicode())
    }

    function suffix(suffix) {
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

    // the actual operation is passed as `this`.
    function exec(flags) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        var src = sequenceHelper.apply(void 0, args)
        return new RegExp(
            src,
            compileFlags(this(currentFlags, flags))
        )
    }

    function op(flags) {
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
