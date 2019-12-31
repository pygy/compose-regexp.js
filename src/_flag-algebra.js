import {map} from './_util.js'
export{
    diff,
    flagOp, 
    gatherFlags, 
    inter, 
    parseFlags, 
    union
}

function union(a, b) {
    return Object.assign(a, b)
}

function inter(a, b) {
    Object.keys(a).forEach(f => {if (!b[f]) delete a[f]})
    return a
}

function diff(a, b) {
    Object.keys(a).forEach(f => {if (b[f]) delete a[f]})
    return a
}

function parseFlags(f) {
    if (f == null) return (console.trace(),{})
    return f.split('').reduce((acc, f) => {
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
            r =>  parseFlags(r.flags || '')
        )
        .reduce(union, {})
    ).join('')
}
