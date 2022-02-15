/**
 * @type {Object.<string, string>} views - the views loaded from the components index.html
 */
const views = {}

/**
 * @typedef {Object} NodeExtension
 * @property {function} $ - alias for this.querySelector
 * @property {function} $$ - alias for this.querySelectorAll
 * @property {function} $ID - alias for this.querySelector with # prepended to sel
 * @property {function} $build - Used to build a new element
 * @property {function} $$build - Used to build a set of new elements
 */

/**
 * @typedef {HTMLTemplateElement & NodeExtension} ExtendedTemplate
 */

/**
 * @typedef {HTMLElement & NodeExtension} ExtendedNode
 */

/**
 * The type defined for each attribute/state in the Comopnent
 * @typedef {Object} Field
 * @property {string} name - The name of the field
 * @property {fieldKind|undefined} kind - Either 'attr' or 'state'. Defaults to 'state'
 * @property {any|undefined} default - the default value for the field
 * @property {boolean|undefined} required - True if this is a required attribute
 */

/**
 * The configuration for the comopnents
 * @typedef {Object} Configuration
 * @property {string} componentPath - The prefix of the URL where the components exist
 * @property {boolean} verbose - True to display verbose log messages
 */

/**
 * Function to be called after the component is connected to the DOM
 * @callback onConnectedCallback
 * @param {Component} self - The component this is being called for
 * @returns {void}
 */

/**
 * The global configuration object
 * @type {Configuration} config
 * */
const config = {
  componentPath: '',
  verbose: false,
}

/**
 * Get the full component url path
 * @param {string} name
 */
function getPath(name) {
  if (config.componentPath) {
    return config.componentPath + name.toLowerCase()
  }
  return name.toLowerCase()
}

/**
 * @readonly
 * @enum {string}
 */
const fieldKind = {
  state: 'state',
  attr: 'attr',
}

/**
 * Build markup under the child node using the given builder
 * @param {Element} child The child node to build markup under
 * @param {*} builder The builder that will create markup under the child, can be function, element, or string
 * @param {boolean} append - True to append children vs replace children
 * @returns The child that was passed into the function
 */
function build(child, builder, append = false) {
  if (typeof builder === 'function') {
    builder = builder()
  }

  if (builder instanceof HTMLElement) {
    append ? child.appendChild(builder) : child.replaceChildren(builder)
  } else if (Array.isArray(builder)) {
    append ? child.append(...builder) : child.replaceChildren(...builder)
  } else {
    child.innerHTML = builder
  }
  return child
}

/**
 * Build markup for each child under the given node
 * @param {Element} node The node whose children we will build markup underto build markup under
 * @param {*} builders Either a list of builders or a single builder to create markup under each child
 * @param {boolean} append - True to append children vs replace children
 * @returns The list of child nodes that were built
 */
function buildAll(node, builders, append = false) {
  let singleBuilder = null
  if (Array.isArray(builders) && node.children.length != builders.length && builders.length != 1) {
    console.error(
      `Number of template builders ${builders.length} doesn't match children ${node.children.length} for node/template ${node.id}`
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

class Component extends HTMLElement {
  /**
   * Define this web component
   */
  static define() {
    customElements.define(this.name, this)
  }

  /**
   * Configure the base component configurations
   * componentPath - The base URL path for the components
   * verbose - Display verbose log messages
   * @param {Configuration} conf
   */
  static configure(conf) {
    Object.assign(config, conf)
  }

  /**
   * Get the attributes that will be watched by the Web Components attribute events
   * @returns {string[]}
   */
  static get observedAttributes() {
    return this.prototype
      .fields()
      .filter((v) => v.kind && v.kind === fieldKind.attr)
      .map((v) => v.name)
  }

  /**
   * @property {boolean} - set to true if you do not need to download a view for this component
   */
  noView = false

  /**
   *
   * @param {Object.<string, any>} defaults - the defaults for the attributes/state of the instance of this object
   * @param {onConnectedCallback} onConnected - callback for after the node is connected to the dom
   */
  constructor(defaults = {}, onConnected = null) {
    super()
    this._defaults = defaults
    this._attrs = {}
    this._state = {}
    this._onConnected = onConnected
  }

  /**
   * The callback from web comonents when an attribute is changed
   * @param {string} name - The name of the updated attr
   * @param {any} oldValue - the old value of the attr
   * @param {any} newValue - the new value of the attr
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue == newValue) return
    if (this._attrs[name] != newValue) {
      this._setField(name, newValue)
    }
  }

  /**
   * Called by web components when comopnent connected to the DOM
   */
  async connectedCallback() {
    await this._initialize()
    await this.onConnected()
    if (this._onConnected) {
      await this._onConnected(this)
    }
  }

  /**
   * Called after connected - should be overriden by child
   * @returns void
   */
  async onConnected() {
    return // Should be overridden
  }

  /**
   * Called by web components when component disconnected from the DOM
   */
  disconnectedCallback() {
    this._wireEvents(true)
    this.onDisconnected()
  }

  /**
   * Called after disconnected - should be overriden by child
   * @returns void
   */
  async onDisconnected() {
    return // Should be overridden
  }

  /**
   * Called by web-dev-server when a hot reload occurs
   */
  async hotReplacedCallback() {
    await this._initialize()
  }

  /**
   * The attributes/state for this component
   * @returns {Field[]}
   */
  fields() {
    return []
  }

  /**
   * Derives default value for field (attribute, state) based on def parameter
   * @param {any} def The default value we're attempting to derive
   * @returns The output from the defautl value
   */
  async _getDefault(def) {
    if (typeof def === 'function' && !(def instanceof HTMLElement)) {
      return await def(this)
    }
    return def
  }

  /**
   * Intialize the given field for this Component instance
   * @param {Field} field The field to initialize
   */
  async _initField(field) {
    const name = field.name
    const isAttr = field.kind && field.kind === fieldKind.attr
    const objs = isAttr ? this._attrs : this._state

    if (this._defaults[name] !== undefined) {
      objs['_' + name] = await this._getDefault(this._defaults[name])
    } else if (isAttr) {
      objs['_' + name] = this.getAttribute(name) || (await this._getDefault(field.default))
    } else {
      objs['_' + name] = await this._getDefault(field.default)
    }

    if (field.required && objs['_' + name] === undefined) {
      throw new Error(`${field.name} is required for component ${this.nodeName}`)
    }

    this['set_' + name] = this['set_' + name]
      ? this['set_' + name]
      : async function (newValue) {
          const oldValue = objs[name]
          if (newValue === oldValue) return

          objs['_' + name] = newValue
          if (isAttr) this.setAttribute(name, newValue)
          const renderData = await this._renderField(name)
          this._wireEvents()
          const eventName = `${name}_updated`
          if (this[eventName]) await this[eventName](newValue, oldValue, renderData)
          this.$dispatch(`${name}_change`, {
            detail: { oldValue, newValue, renderData },
          })
          this.$dispatch(`change`, {
            detail: { oldValue, newValue, renderData, prop: name },
          })
        }

    if (!objs[name]) {
      Object.defineProperty(this, name, {
        get() {
          return objs['_' + name]
        },
        set(v) {
          this['set_' + name](v)
        },
      })
    }
  }

  /**
   * Initialize this component
   */
  async _initialize() {
    this.el = this.el ? this.el : this.attachShadow({ mode: 'open' })
    for (const field of this.fields()) {
      await this._initField(field)
    }
    await this._renderView()
  }

  /**
   * Set el
   * @param {ShadowRoot} value - set the el to this element
   */
  set el(value) {
    this._el = value
  }

  /**
   * Get el
   * @returns {ShadowRoot}
   */
  get el() {
    return this._el
  }

  /**
   * Alias for `this.el.querySelector`
   * @param {string} sel - The selector to use
   * @returns {HTMLElement}
   */
  $(sel) {
    return this.el.querySelector(sel)
  }

  /**
   * Alias for `this.el.querySelectorAll`
   * @param {string} sel - The selector to use
   * @returns {NodeListOf<HTMLElement>}
   */
  $$(sel) {
    return this.el.querySelectorAll(sel)
  }

  /**
   * Extend the given node with methods
   * @param {ExtendedNode|ExtendedTemplate} node The template/node we're extending
   * @param {Element} buildNode The node to build under
   * @returns {(*} The extended element
   */
  _extendElem(node, buildNode = node) {
    node.$ = node.$ ? node.$ : node.querySelector
    node.$$ = node.$$ ? node.$$ : node.querySelectorAll
    node.$ID = node.$ID ? node.$ID : (sel) => node.querySelector('#' + sel)
    node.$build = node.$build
      ? node.$build
      : (builder, append = false) => {
          return build(buildNode, builder, append)
        }
    node.$$build = node.$$build
      ? node.$$build
      : (builders, append = false) => {
          return buildAll(node, builders, append)
        }
    return node
  }

  /**
   * Alias for `this.el.querySelector` and prefixing with a #
   * @param {string} id - The selector to use
   * @returns {ExtendedTemplate}
   */
  $T(id) {
    /** @type {any} */ const template = this.$ID(id)

    /** @type {ExtendedTemplate} */
    const node = template.content.cloneNode(true)
    return this._extendElem(node, node.children[0])
  }

  /**
   * Alias for `this.el.querySelector` and prefixing with a #
   * @param {string} id - The selector to use
   * @returns {ExtendedNode}
   */
  $ID(id) {
    /** @type {any} */ const element = this.$('#' + id)

    /** @type {ExtendedNode} */
    const node = element
    return this._extendElem(node)
  }

  /**
   * Dispatch the given event with the given object data
   * @param {string} event The event to dispatch
   * @param {Object} obj The data to sent through the event
   */
  $dispatch(event, obj) {
    this.dispatchEvent(new CustomEvent(event, obj))
  }

  /**
   * Replace the element with the given selector with this component. Attach old ID to new components attributes as well.
   * @param {string} selector The selector to use to replace the element
   */
  $mount(selector) {
    const el = document.querySelector(selector)
    if (!el) {
      console.error(`No element found for selector ${selector} when trying to mount ${this.constructor.name}`)
    }
    if (el.id) this.id = el.id
    el.replaceWith(this)
  }

  /**
   * Render the given field name
   * @param {string} name THe name of the field to render
   * @returns {Promise<any>} Data returned from the field rendering
   */
  async _renderField(name) {
    if (this['render_' + name]) return await this['render_' + name]()
    return null
  }

  /**
   * Asynchronously set a field's value
   * @param {string} name - the name of the field to set
   * @param {any} value - the value ot set to the field
   */
  async _setField(name, value) {
    if (this['set_' + name]) await this['set_' + name](value)
  }

  /**
   * Render all fields on this component
   */
  async _renderFields() {
    await Promise.all(this.fields().map(async (k) => await this._renderField(k.name)))
  }

  /**
   * Download and return the view for this component
   * @returns {Promise.<string>} The view for this component
   */
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

  /**
   * Bind all of the event mehtods for this component to `this`
   */
  _bindEvents() {
    const props = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    for (let prop of props) {
      if (prop.match(/(?:global_)?(.*)_(.*)_event/)) {
        this[prop] = this[prop].bind(this)
      }
    }
  }

  /**
   * Used to attach (or detach) event listeners from the DOM for this component
   * @param {boolean} detach - True to only detach event listeners
   */
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
        if (config.verbose) console.warn(`No events hooked up for ${prop}`)
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

  /**
   * Render the view for this component
   */
  async _renderView() {
    const name = this.nodeName.toLowerCase()
    const stylePath = getPath(name)
    const style = `<link rel="stylesheet" href="${stylePath}/${name}.css"></link>`
    const view = this.noView ? '' : await this._getView()
    this.el.innerHTML = `${style}\n${view}`

    await this._renderFields()
    this._bindEvents()
    this._wireEvents()
  }
}

export default Component
