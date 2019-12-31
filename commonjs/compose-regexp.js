(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define('compose-regexp', ['exports'], factory) :
    (factory((global.composeRegexp = {})));
}(this, function (exports) { 'use strict';

    var empty$1 = new RegExp('')
    var hasOwn = ({}).hasOwnProperty
    var map = [].map

    // applyCall(f, arguments) passes all but the first arguments to `f`.
    // The first argument ends up passed as context (a.k.a. `this`).
    // so `applyCall(f, [1, 2, 3])` is equivalent to `f.call(1, 2, 3)`
    // The first argument passed as context is usually ignored in this 
    // library. Mind melting ES5 alternative to `f(...args)` in
    // the body of a function with args like this:
    // (x, ...args) => {/* ... */}
    var applyCall = map.apply.bind(map.call)

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

    function parseFlags(f) {
        if (f == null) { return (console.trace(),{}) }
        return f.split('').reduce(function (acc, f) {
            return (acc[f] = true, acc)
        }, {})
    }

    function flagOp(op, a, b) {
        return Object.keys(op(parseFlags(a), parseFlags(b))).join('')
    }

    function gatherFlags() {
        return Object.keys(
            map.call(
                arguments,
                // r can actually be a string hence the `|| ''`
                function (r) { return parseFlags(r.flags || ''); }
            )
            .reduce(union, {})
        ).join('')
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


    var flagOps = Object.freeze({
        add: add,
        keep: keep,
        remove: remove
    });

    var atomicU = /u/.unicode === false &&  new RegExp('^\\\\?[^]$', 'u')

    function normalize (source) {
        if (source instanceof RegExp) { return source.source }
        else { return (source+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&") }
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
    var currentFlags;
    function getUnionFlag() {
        return flagOp(inter, currentFlags, 'u')
    }

    function sequenceHelper() {
        currentFlags = gatherFlags.apply(null, arguments)
        if (arguments.length === 0) { return ''; }
        if (arguments.length === 1) { return normalize(arguments[0]) }
        return map.call(arguments, normalizeForSequence).join('')
    }

    function suffix$1(operator) {
        if (arguments.length === 1) { return empty$1 }
        var res = applyCall(sequenceHelper, arguments)
        return new RegExp(isAtomic(res) ? res + operator : '(?:' + res + ')' + operator, getUnionFlag())
    }

    function flags$1(opts) {
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

    var empty = new RegExp('')

    function sequence () {
        return new RegExp(sequenceHelper.apply(null, arguments), getUnionFlag())
    }

    var validSuffix = sequence(
        /^/,
        either(
            '+', '*', '?',
            /\{\s*\d+(?:\s*,\s*)?\d*\s*\}/
        ),
        /\??$/
    )

    function suffix(suffix) {
        if (!validSuffix.test(suffix)) { throw new Error(("Invalid suffix '" + suffix + "'.")) }
        return (arguments.length === 1)
            ? suffix$1.bind(null, suffix)
            : suffix$1.apply(null, arguments)
    }

    function ref(n) {
        if (!/^\d$/.test(String(n))) { throw new Error (("Invalid back reference: " + (JSON.stringify(n)))) }
        return new RegExp('\\' + n)
    }

    function lookAhead() {
        if (!arguments.length) { return empty; }
        return new RegExp('(?=' + sequenceHelper.apply(null, arguments) + ')', getUnionFlag())
    }

    function avoid() {
        if (!arguments.length) { return empty; }
        return new RegExp('(?!' + sequenceHelper.apply(null, arguments) + ')', getUnionFlag())
    }

    var group = suffix$1.bind(null, '')

    function flags(opts) {
        return arguments.length === 1
        ? flags$1.bind(null, opts)
        : flags$1.apply(null, arguments)
    }

    function capture() {
        return new RegExp('(' + sequenceHelper.apply(null, arguments) + ')', getUnionFlag())
    }

    function createScopedCapture(ns) {
        if ( ns === void 0 ) ns = {};

        var i = 1;
        var anonCount = 0
        function capture(name) {
            if (hasOwn.call(ns, name)) { throw new RangeError(("Attempt to redefine " + name)) }
            ns[name] = i++
            i += anonCount
            anonCount = 0
            return applyCall(coreCapture, arguments)
        }
        function nestedAnon() {
            anonCount++
            return capture.apply(null, arguments)
        }
        return {ns: ns, capture: capture, nestedAnon: nestedAnon}
    }

    exports.flagOps = flagOps;
    exports.avoid = avoid;
    exports.capture = capture;
    exports.createScopedCapture = createScopedCapture;
    exports.either = either;
    exports.flags = flags;
    exports.group = group;
    exports.lookAhead = lookAhead;
    exports.ref = ref;
    exports.sequence = sequence;
    exports.suffix = suffix;

}));
