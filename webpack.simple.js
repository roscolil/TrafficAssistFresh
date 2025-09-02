const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      'react-native-keep-awake': 'react-native-web',
      'react-native-vision-camera': require.resolve('./src/web/camera-mock.js'),
      'react-native-reanimated': 'react-native-web',
      'react-native-geolocation-service': require.resolve('./src/web/geolocation-mock.js'),
      'react-native-heading': require.resolve('./src/web/heading-mock.js'),
      'react-native-tts': require.resolve('./src/web/tts-mock.js'),
      'react-native-haptic-feedback': require.resolve('./src/web/haptic-mock.js'),
      'react-native-fast-tflite': require.resolve('./src/web/tflite-mock.js'),
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
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};
