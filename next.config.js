/** @type {import('next').NextConfig} */
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  
  // Configure webpack for Transformers.js and client-side only
  webpack: (config, { isServer }) => {
    // Alias node-specific modules to browser-compatible versions
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    
    
    if (!isServer) {
      // Add rule for WebAssembly
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      })
      
      // Ignore node-specific modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        global: false,
        process: false,
        buffer: false,
      }
      
      // Define global for browser compatibility
      config.plugins.push(
        new webpack.DefinePlugin({
          'global': 'window',
        })
      )
      
      // Intercept rnnoise.wasm requests
      config.module.rules.push({
        test: /rnnoise\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/chunks/[name][ext]'
        }
      })
    }
    
    // Exclude murmuraba from server-side rendering
    if (isServer) {
      config.externals = [...(config.externals || []), 'murmuraba']
    }

    return config
  },
  
  // Optimize for production
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
}

module.exports = nextConfig