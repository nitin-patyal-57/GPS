// Entrypoint wrapper for Render
// Ensures 'node server' or 'node server/index.js' resolves directly to the compiled server distribution
try {
  require('./dist/index.js')
} catch (err) {
  console.error('[Server Entrypoint] Failed to load ./dist/index.js:', err)
  process.exit(1)
}
