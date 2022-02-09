const views = {}

function getPath(name) {
  if (window.DEFINE_PREFIX) {
    return window.DEFINE_PREFIX + name.toLowerCase()
  }
  return name.toLowerCase()
}

class Component extends HTMLElement {
  static define() {
    customElements.define(this.name, this)
  }

  static get observedAttributes() {
    return this.prototype
      ._getFields()
      .filter((v) => v.kind === 'attr')
      .map((v) => v.name)
  }

  constructor(defaults = {}, onConnected = null) {
    super()
    this._defaults = defaults
    this._attrs = {}
    this._state = {}
    this._onConnected = onConnected
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue == newValue) return
    if (this._attrs[name] != newValue) {
      this._setField(name, newValue)
    }
  }

  async connectedCallback() {
    await this._initialize()
    if (this._onConnected) {
      await this._onConnected(this)
    }
  }

  disconnectedCallback() {
    this._wireEvents(true)
  }

  hotReplacedCallback() {
    this._initialize()
  }

  _getFields() {
    return this.fields ? this.fields() : []
  }

  async _getDefault(def) {
    if (typeof def === 'function' && !(def instanceof HTMLElement)) {
      return await def(this)
    }
    return def
  }

  async _initField(field) {
    const name = field.name
    const isAttr = field.kind === 'attr'
    const objs = isAttr ? this._attrs : this._state
    if (this._defaults[name] !== undefined) {
      objs[name] = await this._getDefault(this._defaults[name])
    } else if (isAttr) {
      objs[name] = this.getAttribute(name) || (await this._getDefault(field.default))
    } else {
      objs[name] = await this._getDefault(field.default)
    }

    if (field.required && objs[name] === undefined) {
      throw new Error(`${field.name} is required for component ${this.nodeName}`)
    }

    this['set_' + name] = async function (newValue) {
      const oldValue = objs[name]
      if (newValue === oldValue) return

      objs[name] = newValue
      if (isAttr) this.setAttribute(name, newValue)
      const renderData = await this._renderField(name)
      this._wireEvents()
      const eventName = `${name}_updated`
      if (this[eventName]) await this[eventName](newValue, oldValue, renderData)
      this.$dispatch(`${name}change`, { detail: { oldValue, newValue, renderData } })
      this.$dispatch(`change`, { detail: { oldValue, newValue, renderData, prop: name } })
    }

    Object.defineProperty(this, name, {
      get() {
        return objs[name]
      },
      set(v) {
        this['set_' + name](v)
      },
    })
  }

  isDebug() {
    if (window.DEBUG !== undefined) {
      return window.DEBUG
    }
    return true
  }

  async _initialize() {
    this.el = this.attachShadow({ mode: this.isDebug() ? 'open' : 'closed' })
    for (const field of this._getFields()) {
      await this._initField(field)
    }
    await this.renderView()
  }

  set el(value) {
    this._el = value
  }

  get el() {
    return this._el
  }

  $(sel) {
    return this.el.querySelector(sel)
  }

  $$(sel) {
    return this.el.querySelectorAll(sel)
  }

  $T(id) {
    let node = this.$ID(id).content.cloneNode(true)
    node.$ = node.querySelector
    node.$$ = node.querySelectorAll
    node.$ID = node.getElementById
    function build(child, builder, append = true) {
      if (typeof builder === 'function') {
        child.innerHTML = builder()
      } else if (builder instanceof HTMLElement) {
        append ? child.appendChild(builder) : child.replaceChildren(builder)
      } else {
        child.innerHTML = builder
      }
      return child
    }
    node.$build = (builder, append = true) => {
      return build(node.children[0], builder, append)
    }
    node.$$build = (builders, append = true) => {
      let singleBuilder = null
      if (Array.isArray(builders) && node.children.length != builders.length && builders.length != 1) {
        console.error(
          `Number of template builders ${builders.length} doesn't match children ${node.children.length} for template ${id}`
        )
        // TODO
        return null
      }
      if (Array.isArray(builders) && builders.length === 1) {
        singleBuilder = builders[0]
      } else if (!Array.isArray(builders)) {
        singleBuilder = builders
      }

      return Array.from(node.children).map((child, idx) => {
        return build(child, singleBuilder ? singleBuilder : builders[idx], append)
      })
    }
    return node
  }

  $ID(id) {
    return this.$('#' + id)
  }

  $dispatch(event, obj) {
    this.dispatchEvent(new CustomEvent(event, obj))
  }

  $mount(selector) {
    const el = document.querySelector(selector)
    if (!el) {
      console.error(`No element found for selector ${selector} when trying to mount ${this.constructor.name}`)
    }
    if (el.id) this.id = el.id
    el.replaceWith(this)
  }

  async _renderField(name) {
    if (this['render_' + name]) return await this['render_' + name]()
    return null
  }

  async _setField(name, value) {
    if (this['set_' + name]) await this['set_' + name](value)
  }

  async _renderFields() {
    this._getFields().forEach(async (k) => await this._renderField(k.name))
  }

  async _getView() {
    try {
      if (!views[this.constructor.name.toLowerCase()]) {
        const resp = await fetch(`${getPath(this.constructor.name)}/${this.constructor.name}.html`)
        views[this.constructor.name.toLowerCase()] = await resp.text()
      }
      return views[this.constructor.name.toLowerCase()]
    } catch (ex) {
      // TODO
      console.error(`An error occurred getting view for component ${this.constructor.name}`, ex)
    }
  }

  _bindEvents() {
    const props = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    for (let prop of props) {
      if (prop.match(/(?:global_)?(.*)_(.*)_event/)) {
        this[prop] = this[prop].bind(this)
      }
    }
  }

  _wireEvents(detach = false) {
    const props = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    for (let prop of props) {
      const match = prop.match(/(?:global_)?(.*)_(.*)_event/)
      if (!match) continue
      const isGlobal = prop.startsWith('global_')
      const idOrClass = match[1]
      const event = match[2]
      let el
      if (idOrClass === 'window') {
        el = [window]
      } else if (idOrClass === 'this') {
        el = [this]
      } else if (idOrClass === 'document') {
        el = [document]
      } else if (isGlobal) {
        el = document.querySelectorAll(`#${idOrClass}`)
        if (!el || !el.length) {
          el = document.querySelectorAll(`.${idOrClass}`)
        }
      } else {
        el = this.$$(`#${idOrClass}`)
        if (!el || !el.length) {
          el = this.$$(`.${idOrClass}`)
        }
      }

      if (!el || !el.length) {
        if (VERBOSE) console.warn(`No events hooked up for ${prop}`)
        continue
      }

      el.forEach((el) => {
        el.removeEventListener(event, this[prop])
        if (!detach) {
          el.addEventListener(event, this[prop])
        }
      })
    }
  }

  async renderView() {
    const name = this.nodeName.toLowerCase()
    const stylePath = getPath(name)
    const style = `<link rel="stylesheet" href="${stylePath}/${name}.css"></link>`
    const view = await this._getView()
    this.el.innerHTML = `${style}\n${view}`

    await this._renderFields()
    this._bindEvents()
    this._wireEvents()
  }
}

export default Component
