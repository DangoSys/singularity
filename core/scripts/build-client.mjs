import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const names = ['canvas', 'node', 'connect', 'sticky', 'report', 'chat', 'human', 'bubble']
const bundles = await Promise.all(names.map(name => readFile(resolve(root, `src/${name}/client.js`), 'utf8')))
const rootId = '@dangosys/dsh-singularity-core'
const modules = names.map(name => `@dangosys/dsh-singularity-core/${name}`)
const entry = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(rootId)},
  factory: (require) => {
    const module = { exports: {} }
    const plugins = [${modules.map(id => `require(${JSON.stringify(id)})`).join(', ')}]
    module.exports.apply = (ctx) => { for (const plugin of plugins) plugin.apply(ctx) }
    module.exports.inject = ['slots', 'sessions', 'remote']
    return module.exports
  },
})
`
await mkdir(resolve(root, 'lib'), { recursive: true })
await writeFile(resolve(root, 'lib/client.js'), `${bundles.join('\n')}\n${entry}`)
