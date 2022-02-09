#!/usr/bin/env node
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
  default:
    console.log(`Unknown command option: ${args[0]}`)
}

function previewComponent(componentPath, name, ...attrs) {
  const dir = path.join(componentPath, name)

  if (!fs.existsSync(dir)) {
    console.error(`Could not find component ${name} at ${componentPath}`)
    process.exit(5)
  }

  const attributes = attrs
    .map((x) => {
      const attr = x.split(':', 2)[0]
      const val = x.split(':', 2)[1]
      console.log(x)
      console.log(attr)
      console.log(val)
      return `${attr}="${val}"`
    })
    .join(' ')
  console.log(attributes)
  const html = `<html>
  <head>
    <script type="module" src="${name}/${name}.js"></script>
  </head>
  <body>
    <${name} ${attributes}></${name}>
  </body>
</html>
`
  const index = path.join(dir, `index.html`)

  fs.writeFileSync(index, html)

  async function main() {
    const server = await startDevServer({
      argv: ['--open', `/${name}`],
    })
  }

  main()
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
