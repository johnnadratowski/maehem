import { hmrPlugin } from '@open-wc/dev-server-hmr'

export default {
  // in a monorepo you need to set set the root dir to resolve modules
  plugins: [
    hmrPlugin({
      include: ['**/*.js'],
    }),
  ],
}
