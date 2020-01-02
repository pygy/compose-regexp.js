const o = require('ospec')

const CR = require("../../commonjs/compose-regexp.js")

o.spec("cjs main", ()=> {

// -----8<---- snip

    function req(a, b) {
        o(a.source).equals(b.source)((new Error).stack.split('\n')[2])
    }
    const {avoid, capture, either, flags, lookAhead, ref, sequence, suffix} = CR

    o('consistent output returned when combinators are called without args', () => {
        void [
            either, sequence,
            suffix('*'),
            lookAhead, avoid,
            flags('')
        ].forEach(function(fn) {

            o(fn().source).equals('(?:)')
        })

        o(capture().source).equals('()')
    })

    o('string escaping', () => {
        void [
            either, sequence,
            suffix('*'),
            lookAhead, avoid,
            flags(''), capture
        ].forEach(function(fn) {
            ".?*+{[()\\^$|".split('').forEach(char => {
            // normalization
                const re = new RegExp('\\'+char)

                req(fn(re), fn(char))
            })
            // empty arg list
            if (fn !== capture)
                req(fn(), new RegExp(''))
            else
                req(fn(), /()/)
        })
    })

    o("characters that don't need escaping are left as is", () => {
        void [
            either, sequence,
            suffix('*'),
            lookAhead, avoid,
            flags(''), capture
        ].forEach(function(fn) {
            "]}-az10".split('').forEach(char => {
            // normalization
            const re = new RegExp(char)
            req(fn(re), fn(char))

            })
        })
    })

    o('either', () =>  {
        req(either('a'), /a/)
        req(either('a','b'), /a|b/)
        req(either('a', 'b', 'c'), /a|b|c/)
        req(either('a', 'b', /c|d/), /a|b|c|d/)
    })

    o('sequence', () =>  {
        req(sequence('a'), /a/)
        req(sequence('a', 'b'), /ab/)
        req(sequence('a', 'b', 'c'), /abc/)
        req(sequence('a', /b|c/), /a(?:b|c)/)
        req(sequence(/a|b/, /c/), /(?:a|b)c/)
        req(sequence(/^/, 'b', /$/), /^b$/)
        req(sequence(/a|b/), /a|b/)
        req(either(sequence(sequence(/a|b/))), /a|b/)
        req(sequence('thingy', either(/[a]/, /b/)), /thingy(?:[a]|b)/)
    })

    o('avoid', () => {
        req(avoid('a'), /(?!a)/)
        req(avoid('a', 'b'), /(?!ab)/)
        req(avoid('a', 'b', /c/), /(?!abc)/)
        req(avoid(/ab|c/), /(?!ab|c)/)
    })

    o('lookAhead', () => {
        req(lookAhead('a'), /(?=a)/)
        req(lookAhead('a', 'b'), /(?=ab)/)
        req(lookAhead('a', 'b', /c/), /(?=abc)/)
        req(lookAhead(/ab|c/), /(?=ab|c)/)
    })

    o('capture', () => {
        req(capture('a'), /(a)/)
        req(capture('a', 'b'), /(ab)/)
        req(capture('a', 'b', 'c'), /(abc)/)
        req(capture(/ab|c/), /(ab|c)/)
    })

    o('req', () => {
        req(ref(1), /\1/)
        req(ref(9), /\9/)
    })

    o.spec('flags', () => {
        o('kitchen sink', () => {
            var flagKinds = {
                g: 'global',
                i: 'ignoreCase',
                m: 'multiline'
            }
            ;[['s', 'dotAll'], ['u', 'unicode'], ['y', 'sticky']].forEach(function(pair){
                try {
                    new RegExp('', pair[0])
                    flagKinds[pair[0]] = pair[1]
                } catch(e) {}
            })
            flags('g')
            for (var k in flagKinds) {
                o(flags(k, /o/)[flagKinds[k]]).equals(true)
                o(flags(k)(/o/)[flagKinds[k]]).equals(true)
                for (var kk in flagKinds) if (k !== kk) {
                    o(flags(kk, /o/)[flagKinds[k]]).equals(false)
                    o(flags(kk)(/o/)[flagKinds[k]]).equals(false)
                }
            }    
        })
        o('specificity', () => {
            o(flags('m', /o/).multiline).equals(true)
            o(flags('i', /o/).multiline).equals(false)
        })
    })

    o.spec('suffix', () => {
        o('works', () => {
            [
                '*', '+', '?', '{2}', '{2,}', '{2,4}',
                '*?', '+?', '??', '{2}?', '{2,}?', '{2,4}?',
            ].forEach(function(op){
                o(suffix(op, 'a').source).equals('a' + op)
                o(suffix(op, 'foo').source).equals('(?:foo)' + op)
                o(suffix(op, 'a').source).equals('a' + op)
                o(suffix(op, 'a').source).equals('a' + op)
                req(suffix(op, 'a'), {source: 'a' + op})
                req(suffix(op, /foo/), {source: '(?:foo)' + op})
                req(suffix(op, /a|b/), {source: '(?:a|b)' + op})
                req(suffix(op, /(a)b/), {source: '(?:(a)b)' + op})
                o(suffix(op, /(ab)/).source).equals('(ab)' + op)
                req(suffix(op)('a'), {source: 'a' + op})
            })
        })
        o('invalid ranges throw', () => {
            ['a', '5.', '{5.4}', '{ 4 }', '{1, 5}', '{3,1}'].forEach(function(op){
                o(() =>  { suffix(op, 'a') }).throws(Error)
                o(() =>  { suffix(op) }).throws(Error)
            })

        })
    })

// -----8<---- snip

})