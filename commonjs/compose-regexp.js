(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define('compose-regexp', ['exports'], factory) :
    (factory((global.composeRegexp = {})));
}(this, function (exports) { 'use strict';

    var empty = new RegExp('')

    function normalize (source) {
        if (source instanceof RegExp) return source.source
        else return (source+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&")
    }

    // TODO investigate -] in charSets for isSequential and forSequence
    var tokenMatcher = /(\\[^])|\[\-|[-()|\[\]]/g

    // When composing expressions into a sequence, regexps that have a top-level
    // choice operator must be wrapped in a non-capturing group. This function
    // detects whether the group is needed or not.
    function hasTopLevelChoice(source) {
        if (source.indexOf('|') === -1) return false
        var depth = 0, inCharSet = false, match
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
    function isOneGroup(source) {
        if (source.charAt(0) !== '(' || source.charAt(source.length - 1) !== ')') return false
        var depth = 0, inCharSet = false, match
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

    function forSequence(source) {
        source = normalize(source)
        return hasTopLevelChoice(source) ? '(?:' + source + ')' : source
    }

    // Determine if a pattern can take a suffix operator or if a non-capturing group
    // is needed around it.
    // We can safely have false negatives (consequence: useless non-capturing groups)
    // whereas false positives would be bugs. We do ahve some false positives:
    // some charsets will be marked as non-atomic.
    function isAtomic(source) {
        return source.length === 1 || /^\\[^]$|^\[(?:\\[^]|[^\]])*\]$/.test(source) || isOneGroup(source)
    }

    var map = [].map

    function either() {
        if (!arguments.length) return empty;
        return new RegExp(map.call(arguments, normalize).join('|'))
    }

    function _sequence() {
        if (arguments.length === 0) return '';
        if (arguments.length === 1) return normalize(arguments[0])
        return map.call(arguments, forSequence).join('')
    }

    function sequence () {
        return new RegExp(_sequence.apply(null, arguments))
    }

    var validSuffix = sequence(
        /^/,
        either(
            '+', '*', '?',
            /\{\s*\d+(?:\s*,\s*)?\d*\s*\}/
        ),
        /\??$/
    )

    var call = _suffix.call
    function _suffix(operator) {
        if (arguments.length === 1) return empty
        // an attrocious hack to pass all arguements but the operator to `_sequence()`
        // without allocating an array. The operator is passed as `this` which is ignored.
        var res = call.apply(_sequence, arguments)
        return new RegExp(isAtomic(res) ? res + operator : '(?:' + res + ')' + operator)
    }

    function suffix(suffix) {
        if (!validSuffix.test(suffix)) throw new Error("Invalid suffix '" + suffix+ "'.")
        return (arguments.length === 1)
            ? _suffix.bind(null, suffix)
            : _suffix.apply(null, arguments)
    }

    function ref(n) {
        return new RegExp('\\' + n)
    }

    function lookAhead() {
        if (!arguments.length) return empty;
        return new RegExp('(?=' + _sequence.apply(null, arguments) + ')')
    }

    function avoid() {
        if (!arguments.length) return empty;
        return new RegExp('(?!' + _sequence.apply(null, arguments) + ')')
    }

    function _flags(opts) {
        return new RegExp(call.apply(_sequence, arguments), opts)
    }

    function flags(opts) {
        return arguments.length === 1
        ? _flags.bind(null, opts)
        : _flags.apply(null, arguments)
    }

    function capture () {
        if (!arguments.length) return new RegExp('()');
        return new RegExp('(' + _sequence.apply(null, arguments) + ')')
    }

    exports.hasTopLevelChoice = hasTopLevelChoice;
    exports.isOneGroup = isOneGroup;
    exports.either = either;
    exports.sequence = sequence;
    exports.suffix = suffix;
    exports.ref = ref;
    exports.lookAhead = lookAhead;
    exports.avoid = avoid;
    exports.flags = flags;
    exports.capture = capture;

}));