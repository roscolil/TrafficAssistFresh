const HtmlWebpackPlugin = require('html-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      'react-native-keep-awake': require.resolve('./src/web/keep-awake-mock.js'),
      'react-native-vision-camera': require.resolve('./src/web/camera-mock.js'),
      'react-native-reanimated': 'react-native-web',
      'react-native-geolocation-service': require.resolve('./src/web/geolocation-mock.js'),
      'react-native-heading': require.resolve('./src/web/heading-mock.js'),
      'react-native-tts': require.resolve('./src/web/tts-mock.js'),
      'react-native-haptic-feedback': require.resolve('./src/web/haptic-mock.js'),
      'react-native-fast-tflite': require.resolve('./src/web/tflite-mock.js'),
      // Bypass the model file completely in web builds
      './models/tlr_yolov8n_int8.tflite': 'data:text/plain;base64,',
    },
    extensions: ['.web.js', '.js', '.web.ts', '.ts', '.web.tsx', '.tsx', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: './babel.config.web.js',
          },
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource',
      },
      {
        test: /\.tflite$/,
        type: 'asset/resource',
        generator: {
          filename: 'models/[name][ext]',
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      '__IS_WEB__': JSON.stringify(true),
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /\.tflite$/,
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    ...(isProduction
      ? [
        new WorkboxPlugin.GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        }),
      ]
      : []),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 3000,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
