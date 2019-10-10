import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  input: 'index.js',
  output: {
    file: 'dist/three-effects.js',
    format: 'esm'
  },
  plugins: [
    nodeResolve()
  ]
};