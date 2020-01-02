import {readdirSync, readFileSync, writeFileSync} from 'fs'
import {join} from 'path'

const snip = '// -----8<---- snip\n'

const cjsPath = join(process.cwd(), './tests/cjs')
const esmPath = join(process.cwd(), './tests')

const cjsFiles = new Set(readdirSync(cjsPath))
const esmFiles = readdirSync(esmPath).filter(name => /\.js$/.test(name))

esmFiles.forEach(name => {
    if (cjsFiles.has(name)) {
        const esmChunks = readFileSync(join(esmPath, name), 'utf-8').split(snip)
        if (esmChunks.length !== 3) throw new Error(`Malformed esm ${name}`)
        const cjsChunks = readFileSync(join(cjsPath, name), 'utf-8').split(snip)
        if (cjsChunks.length !== 3) throw new Error(`Malformed cjs${name}`)

        cjsChunks[1] = esmChunks[1]

        writeFileSync(join(cjsPath, name), cjsChunks.join(snip), 'utf-8')
        
    } else {
        console.warn(`No matching cjs entry for ${name}.`)
    }
})
