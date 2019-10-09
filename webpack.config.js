const path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'three-effects.js',
    path: path.resolve(__dirname, 'dist'),
  },
};