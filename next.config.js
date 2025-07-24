/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  
  // Configure webpack for Transformers.js and client-side only
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
}

module.exports = nextConfig