var webpack = require("webpack");
var path = require("path");

module.exports = {
  entry: './jsx/user.jsx',
  output: {
    filename: 's/js/bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.jsx$/,
        loader: 'jsx-loader'
      }
    ]
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
    // npm install
    root: "/usr/local/lib/node_modules"
  }
};
