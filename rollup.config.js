import nodeResolve from 'rollup-plugin-node-resolve';

export default [{
  input: 'index.js',
  output: {
    file: 'dist/three-effects.js',
    format: 'esm'
  },
  plugins: [
    nodeResolve()
  ]
},
{
  input: 'index.js',
  external: ["three"],
  output: {
    file: 'dist/three-effects.module.js',
    format: 'esm'
  }
}];