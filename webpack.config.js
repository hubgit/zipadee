const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
const WorkboxWebpackPlugin = require('workbox-webpack-plugin')

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  output: {
    filename: 'js/[name].[contenthash].js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  performance: {
    hints: false,
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin([
      { from: 'public/manifest.json' },
      { from: 'public/zip-192.png' },
      { from: 'public/zip-512.png' },
      { from: 'public/zip-512.png', to: 'public/apple-touch-icon.png' },
    ]),
    new HtmlWebpackPlugin({
      favicon: 'public/favicon.ico',
      template: 'public/index.ejs',
      title: 'Zipadee',
      ga: 'UA-143268750-2',
    }),
    new MonacoWebpackPlugin({
      output: 'workers',
    }),
    new WorkboxWebpackPlugin.GenerateSW({
      swDest: 'service-worker.js',
      clientsClaim: true,
      skipWaiting: true,
    }),
  ],
  devServer: {
    contentBase: './dist',
  },
}
