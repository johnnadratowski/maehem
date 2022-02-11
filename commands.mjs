#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { startDevServer } from '@web/dev-server'

const args = process.argv.slice(2)

if (args.includes('-h')) {
  const output = `
  Component Admin Subcommands
  ===========================

  new - Create a new component structure at the given path with the given name

    Usage:
      node . new PATH NAME

    Args:
      PATH: Path on which to create new component
      NAME: Name of the component to create

    Example:
      node . new './components' my-component

  ------------------------------------------------------------------------------------------------
  preview - Run in development preview mode with hot module reloading

    Usage:
      node . preview PATH NAME ...ATTRS

    Args:
      PATH: Path on which to create new component
      NAME: Name of the component to create
      ATTRS: The list of attributes to pass to the component

    Example:
      node . preview './components' my-component id:myComponent foo:bar refresh:false

  ------------------------------------------------------------------------------------------------
  `
  console.log(output)
  process.exit(2)
}

if (args.length === 0) {
  console.error('No subcommand specified')
  process.exit(1)
}

switch (args[0]) {
  case 'new':
    makeComponent(...args.slice(1))
    break
  case 'preview':
    previewComponent(...args.slice(1))
    break
  case 'serve':
    serve(...args.slice(1))
    break
  default:
    console.log(`Unknown command option: ${args[0]}`)
    process.exit(9)
}

function envs() {
  const env = dotenv.config()
  if (!env.parsed) {
    console.warn('No .env file found in this directory')
    return {}
  }

  const output = {}
  for (let k of Object.keys(env.parsed)) {
    if (k.toLowerCase().includes('password')) continue
    output[k] = env.parsed[k]
  }
  return output
}

function scriptDir() {
  return path.dirname(import.meta.url).substring(7)
}

function previewComponent(componentPath, name, ...attrs) {
  const dir = path.join(componentPath, name)

  if (!fs.existsSync(dir)) {
    console.error(`Could not find component ${name} at ${componentPath}`)
    process.exit(5)
  }

  const attributes = attrs.reduce((output, x) => {
    const attr = x.split(':', 2)[0]
    const val = x.split(':', 2)[1]
    output[attr] = val
    return output
  }, {})
  const html = `<html>
  <head>
    <script src="${name}/env.js"></script>
    <script type="module">
    import Component from "./${name}/${name}.js"
    new Component(JSON.parse('${JSON.stringify(attributes)}')).$mount("#content")
    </script>
  </head>
  <body>
    <div id="content"></div>
  </body>
</html>
`
  const index = path.join(dir, `index.html`)

  fs.writeFileSync(index, html)

  const env = path.join(dir, `env.js`)
  generatEnv(env)

  runServe('--open', `/${dir}`)
}

function generatEnv(env) {
  const output = `
    process = {
      env: {}
    }
    process.env = JSON.parse('${JSON.stringify(envs())}')
  `
  fs.writeFileSync(env, output)
}

function runServe(...args) {
  async function main() {
    const serverArgs = ['--debug', '-c', scriptDir() + '/web-dev-server.config.mjs', ...args]
    console.log(serverArgs)
    await startDevServer({
      argv: serverArgs,
    })
  }

  main()
}

function serve(index) {
  const absIndex = path.resolve(index)
  const dir = path.dirname(absIndex)
  const env = path.join(dir, `env.js`)
  generatEnv(env)
  runServe('--open', `/`, '-a', path.resolve(index))
}

function makeComponent(componentPath, name) {
  const dir = path.join(componentPath, name)

  if (fs.existsSync(dir)) {
    console.error(`Directory ${dir} already exists.`)
    process.exit(3)
  }

  try {
    fs.mkdirSync(dir)
  } catch (ex) {
    console.error(`An error occurred creating component directory ${dir}`, ex)
  }

  const css = path.join(dir, `${name}.css`)
  const html = path.join(dir, `${name}.html`)
  const js = path.join(dir, `${name}.js`)
  const className = name
    .split('-')
    .map((x) => x.charAt(0).toUpperCase() + x.substr(1).toLowerCase())
    .join('')

  createFile(css)
  createFile(html)
  createFile(js)

  const jsTemplate = `import Component from '../comp.js'

export default class ${className} extends Component {
  static name = '${name}'

  fields() {
    return [
    ]
  }
}

${className}.define()
`

  fs.writeFileSync(js, jsTemplate)

  console.log(`Component ${name} successfully created at ${dir}`)
}

function createFile(filename) {
  try {
    fs.closeSync(fs.openSync(filename, 'w'))
  } catch (ex) {
    console.error(`An error occurred trying to create ${file}`)
  }
}
