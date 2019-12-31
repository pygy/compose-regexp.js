import {default as o} from 'ospec'
import * as CR from ".."

function req(a, b) {
    o(a.source).equals(b.source)((new Error).stack.split('\n')[2])
}

var either = CR.either
var sequence = CR.sequence
var suffix = CR.suffix
var ref = CR.ref
var lookAhead = CR.lookAhead
var avoid = CR.avoid
var flags = CR.flags
var capture = CR.capture

o('either', function() {
    req(either('a'), /a/)
    req(either('a','b'), /a|b/)
    req(either('a', 'b', 'c'), /a|b|c/)
})

o('string and no arguments normalization', function(){
    [
        either, sequence,
        suffix('*'),
        lookAhead, avoid,
        flags(''), capture
    ].forEach(function(m) {
        // normalization
        req(m(/\./), m('.'))
        // empty arg list
        if (m !== capture)
            req(m(), new RegExp(''))
        else
            req(m(), /()/)
    })
})

o('sequence', function() {
    req(sequence('a'), /a/)
    req(sequence('a', 'b'), /ab/)
    req(sequence('a', 'b', 'c'), /abc/)
    req(sequence('a', /b|c/), /a(?:b|c)/)
    req(sequence(/^/, 'b', /$/), /^b$/)
    req(sequence(/a|b/), /a|b/)
    req(either(sequence(sequence(/a|b/))), /a|b/)
    req(sequence('thingy', either(/[a]/, /b/)), /thingy(?:[a]|b)/)
})

o('avoid', function(){
    req(avoid('a'), /(?!a)/)
    req(avoid('a', 'b'), /(?!ab)/)
    req(avoid('a', 'b', 'c'), /(?!abc)/)
})

o('lookAhead', function(){
    req(lookAhead('a'), /(?=a)/)
    req(lookAhead('a', 'b'), /(?=ab)/)
    req(lookAhead('a', 'b', 'c'), /(?=abc)/)      
})

o('capture', function(){
    req(capture('a'), /(a)/)
    req(capture('a', 'b'), /(ab)/)
    req(capture('a', 'b', 'c'), /(abc)/)
})

o('req', function(){
    req(ref(1), /\1/)
    req(ref(9), /\9/)    
})

o('flags', function(){
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
        for (kk in flagKinds) if (k !== kk) {
            o(flags(kk, /o/)[flagKinds[k]]).equals(false)
            o(flags(kk)(/o/)[flagKinds[k]]).equals(false)
        }
    }
    o(flags('m', /o/).multiline).equals(true)
    o(flags('i', /o/).multiline).equals(false)
})

o.spec('suffx', function(){
    o('works', function(){
        [
            '*', '+', '?', '{2}', '{2,}', '{2,4}',
            '*?', '+?', '??', '{2}?', '{2,}?', '{2,4}?',
        ].forEach(function(op){
            req(suffix(op, 'a'), {source: 'a' + op})
            req(suffix(op, /foo/), {source: '(?:foo)' + op})
            req(suffix(op, /a|b/), {source: '(?:a|b)' + op})
            req(suffix(op, /(a)b/), {source: '(?:(a)b)' + op})
            req(suffix(op)('a'), {source: 'a' + op})
        })
    })
    o('invalid ranges throw', function(){
        ['a', '5.', '{5.4}'].forEach(function(op){
            o(function() { suffix(op, 'a') }).throws(Error)
            o(function() { suffix(op) }).throws(Error)
        })
          
    })    
})

o.spec('parsers', function(){
    o('hasTopLevelChoice', function(){
        o(CR.hasTopLevelChoice('ab')).equals(false)
        o(CR.hasTopLevelChoice('[a]b')).equals(false)
        o(CR.hasTopLevelChoice('[a|b]')).equals(false)
        o(CR.hasTopLevelChoice('(a|b)')).equals(false)
        o(CR.hasTopLevelChoice('a|b')).equals(true)
        o(CR.hasTopLevelChoice('[a]|b')).equals(true)
    })
})
