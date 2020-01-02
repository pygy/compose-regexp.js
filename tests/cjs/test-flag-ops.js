const o = require('ospec')

const {add, remove, keep} = require("../../commonjs/compose-regexp.js").flagOps

o.spec("cjs main", ()=> {

// -----8<---- snip

    o('add', () => {
        o(add('i', /e/).flags).equals('i')
        o(add('i', /e/i).flags).equals('i')
        o([...add('i', /e/g).flags].sort()).deepEquals(['g', 'i'])
    })

    o('remove', () => {
        o(remove('i', /e/).flags).equals('')
        o(remove('i', /e/i).flags).equals('')
        o(remove('i', /e/ig).flags).deepEquals('g')
        o(remove('gi', /e/ig).flags).deepEquals('')
    })

    o('keep', () => {
        o(keep('i', /e/).flags).equals('')
        o(keep('i', /e/i).flags).equals('i')
        o(keep('im', /e/i).flags).equals('i')
        o(keep('i', /e/igm).flags).equals('i')
        o([...keep('im', /e/igm).flags].sort()).deepEquals(['i', 'm'])
        o([...keep('img', /e/igm).flags].sort()).deepEquals(['g', 'i', 'm'])
    })

// -----8<---- snip

})
