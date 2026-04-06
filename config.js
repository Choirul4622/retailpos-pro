// ============================================
// CONFIGURATION - SUPERMARKET POS
// GANTI API_URL dengan URL deployment Google Apps Script Anda
// ============================================

const CONFIG = {
  VERSION: '4.0.0',
  COMPANY_NAME: 'SUPERMARKET POS',
  CURRENCY: 'Rp',
  PPN_RATE: 0.11,
  MIN_STOCK_ALERT: 10,
  
  // ⚠️ GANTI DENGAN URL DEPLOYMENT GOOGLE APPS SCRIPT ANDA ⚠️
  // Cara mendapatkan: Deploy > New deployment > Web app > Copy URL
  API_URL: 'https://script.google.com/macros/s/AKfycbzDgZwWjdwvqPPbch3Z4DNqoiYPnXn7ttm2WUaWDMo4ofkmBuw4R0gYaODlMz4D9uz-2w/exec'
};

// Export untuk penggunaan global
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
