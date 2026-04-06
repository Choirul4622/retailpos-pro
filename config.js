// ============================================
// CONFIGURATION - SUPERMARKET POS
// ============================================

const CONFIG = {
  VERSION: '4.0.0',
  COMPANY_NAME: 'SUPERMARKET POS',
  CURRENCY: 'Rp',
  PPN_RATE: 0.11,
  MIN_STOCK_ALERT: 10,
  
  // Google Apps Script Web App URL (GANTI DENGAN URL DEPLOYMENT ANDA)
  // Cara mendapatkan URL: Deploy > New deployment > Web app > Get URL
  API_URL: 'https://script.google.com/macros/s/AKfycbzDgZwWjdwvqPPbch3Z4DNqoiYPnXn7ttm2WUaWDMo4ofkmBuw4R0gYaODlMz4D9uz-2w/exec'
};

// Export untuk digunakan di file lain
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
