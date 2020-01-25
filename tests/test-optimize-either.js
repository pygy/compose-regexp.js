import {default as o} from 'ospec'

import {optimizeEither as oe} from '../src/optimize-either.js'

o.spec("optimize either", () => {
    o("is a function", () => {
        o(typeof oe).equals('function')
    })
    o("works?", () => {
        o(oe(['a']).join('|')).equals('a')
        o(oe(['a', 'b']).join('|')).equals('[ab]')
    })
    o("works?2", () => {
        o(oe(['a', 'c', 'b']).join('|')).equals('[a-c]')
        o(oe(['a', 'c', 'b', 'd', 'f']).join('|')).equals('[a-df]')
    })
})
