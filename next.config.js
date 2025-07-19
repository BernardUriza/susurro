/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React 19 features
  experimental: {
    reactCompiler: false, // Set to true if you want to use React Compiler
  },
  
  // Configure webpack for Transformers.js
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Alias node-specific modules to browser-compatible versions
      config.resolve.alias = {
        ...config.resolve.alias,
        "sharp$": false,
        "onnxruntime-node$": false,
      }
      
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
      }
    }

    return config
  },
  
  // Optimize for production
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  
  // Configure for static export if needed
  output: process.env.BUILD_STANDALONE === 'true' ? 'export' : undefined,
}

module.exports = nextConfig