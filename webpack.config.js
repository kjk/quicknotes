//var webpack = require("webpack");

module.exports = {
  entry: './jsx/App.jsx',
  output: {
    filename: 's/js/bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.jsx$/,
        loader: 'jsx-loader'
      },
      {
        test: /\.css$/,
        loader: "style!css"
      }]
  },
  externals: {
    //don't bundle the 'react' npm package with our bundle.js
    //but get it from a global 'React' variable
    'react': 'React'
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  resolveLoader: {
    // this is on mac os with npm installed with brew and
    // npm install -g for packages
    root: "/usr/local/lib/node_modules"
  }
};
