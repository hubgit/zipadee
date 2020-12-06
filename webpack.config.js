const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
const WorkboxWebpackPlugin = require('workbox-webpack-plugin')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

const dist = path.resolve(process.cwd(), 'dist')

const isDevelopment = process.env.NODE_ENV !== 'production'

const plugins = [
  new CleanWebpackPlugin(),
  new CopyWebpackPlugin({
    patterns: [
      { from: 'public/manifest.json' },
      { from: 'public/zip-192.png' },
      { from: 'public/zip-512.png' },
      { from: 'public/apple-touch-icon.png' },
    ],
  }),
  new HtmlWebpackPlugin({
    favicon: 'public/favicon.ico',
    template: 'public/index.html',
    title: 'Zipadee',
    ga: 'UA-143268750-2',
  }),
  new MonacoWebpackPlugin({
    output: 'workers',
    filename: '[name].worker.[contenthash].js',
    languages: [
      'css',
      'html',
      'javascript',
      'json',
      'markdown',
      'php',
      'python',
      'shell',
      'typescript',
      'xml',
      'yaml',
    ],
  }),
  new ReactRefreshWebpackPlugin(),
  new WorkboxWebpackPlugin.GenerateSW({
    swDest: 'service-worker.js',
    maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
  }),
]

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: isDevelopment ? ['react-refresh/babel'] : [],
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        use: ['file-loader'],
      },
    ],
  },
  output: {
    filename: 'js/[name].[contenthash].js',
    path: dist,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer'),
      stream: require.resolve('stream-browserify'),
    },
  },
  performance: {
    hints: false,
  },
  plugins,
  devServer: {
    liveReload: false,
    static: [dist],
  },
}
