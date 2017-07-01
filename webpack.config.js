var path = require('path');

module.exports = {
  entry: './ts/App.tsx',
  output: {
    filename: 'webpack_bundle.js',
    path: path.resolve(__dirname, 'static', 'dist')
  },

  devtool: "source-map",

  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },

  module: {
    rules: [
      { test: /\.tsx?$/, loader: "awesome-typescript-loader" },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
    ]
  },
};
