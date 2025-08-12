// InnSync Configuration
// Update this file with your ngrok URL when running the tunnel

window.INNSYNC_CONFIG = {
  // Replace with your ngrok URL (e.g., 'https://abc123.ngrok.io')
  NGROK_URL: 'https://46238a3ed91d.ngrok-free.app',
  
  // Local development settings (usually don't need to change)
  LOCAL_API_PORT: 8080,
  
  // Debug mode - set to true to see API base URL in console
  DEBUG: false
};

// Auto-detect environment and set API base
if (window.INNSYNC_CONFIG.DEBUG) {
  console.log('Environment detected:', {
    hostname: window.location.hostname,
    isGitHubPages: window.location.hostname.includes('github.io'),
    protocol: window.location.protocol
  });
}
