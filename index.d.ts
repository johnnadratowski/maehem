declare module 'maehem' {
  export default Component
  interface Configuration {
    [key: string]: any
  }

  interface State {
    [key: string]: any
  }

  enum FieldKind {
    State = 'state',
    Attr = 'attr',
  }

  interface Field {
    name: string
    kind: FieldKind
    default?: any
    required?: boolean
  }

  type onConnected = (self: Component) => void

  interface ExtendedTemplate extends HTMLTemplateElement {
    $(sel: string): HTMLElement
    $$(sel: string): HTMLElement[]
    $ID(id: string): HTMLElement
    $build(builder: any, append: boolean): HTMLElement
    $$build(builder: any, append: boolean): HTMLElement[]
  }

  interface ExtendedNode extends HTMLElement {
    $(sel: string): HTMLElement
    $$(sel: string): HTMLElement[]
    $ID(id: string): HTMLElement
    $build(builder: any, append: boolean): HTMLElement
    $$build(builder: any, append: boolean): HTMLElement[]
  }

  class Component extends HTMLElement {
    static define(): void
    static configure(conf: Configuration): void
    static get observedAttributes(): string[]
    noView: boolean
    constructor(defaults?: State, onConnected?: onConnected)
    _defaults: State
    _attrs: State
    _state: State
    _onConnected: onConnected
    attributeChangedCallback(name: string, oldValue: any, newValue: any): void
    connectedCallback(): Promise<void>
    disconnectedCallback(): void
    hotReplacedCallback(): void
    fields(): Field[]
    _getDefault(def: any): Promise<any>
    _initField(field: Field): Promise<void>
    isDebug(): boolean
    _initialize(): Promise<void>
    set el(arg: HTMLElement)
    get el(): HTMLElement
    _el: HTMLElement
    $(sel: string): HTMLElement
    $$(sel: string): HTMLElement[]
    $T(id: string): ExtendedTemplate
    $ID(id: string): ExtendedNode
    $dispatch(event: string, obj: any): void
    $mount(selector: string): void
    _renderField(name: string): Promise<any>
    _setField(name: string, value: any): Promise<void>
    _renderFields(): Promise<void>
    _getView(): Promise<string>
    _bindEvents(): void
    _wireEvents(detach?: boolean): void
    renderView(): Promise<void>
  }
}
