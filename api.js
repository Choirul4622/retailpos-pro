// ============================================
// API WRAPPER FOR GOOGLE APPS SCRIPT
// Menggunakan Fetch API murni, tanpa google.script.run
// ============================================

class POSAPI {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async call(action, data = {}) {
    try {
      console.log(`Calling API: ${action}`, data);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      });
      
      if (!response.ok) {
        // Jika unauthorized (401), coba tanpa credentials
        if (response.status === 401) {
          console.warn('Unauthorized, trying without credentials...');
          const retryResponse = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: action,
              data: data
            })
          });
          
          if (!retryResponse.ok) {
            throw new Error(`HTTP error! status: ${retryResponse.status}`);
          }
          
          const result = await retryResponse.json();
          return result;
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`API Response for ${action}:`, result);
      return result;
      
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Database Methods
  async initializeDatabase() {
    return await this.call('initializeDatabase');
  }

  async addProduct(productData) {
    return await this.call('addProduct', productData);
  }

  async searchProducts(query = '') {
    return await this.call('searchProducts', { query });
  }

  async updateStock(productId, quantity, type, reference) {
    return await this.call('updateStock', { productId, quantity, type, reference });
  }

  async createTransaction(transactionData) {
    return await this.call('createTransaction', transactionData);
  }

  async getDashboardData() {
    return await this.call('getDashboardData');
  }

  async getInventorySummary() {
    return await this.call('getInventorySummary');
  }

  async getRecentTransactions(limit = 10) {
    return await this.call('getRecentTransactions', { limit });
  }

  async getSystemConfig() {
    return await this.call('getSystemConfig');
  }

  async getCurrentUser() {
    return await this.call('getCurrentUser');
  }

  async backupData() {
    return await this.call('backupData');
  }

  async cleanupEmptyRows() {
    return await this.call('cleanupEmptyRows');
  }

  async testSystem() {
    return await this.call('testSystem');
  }
}

// Initialize API - GANTI DENGAN URL DEPLOYMENT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbzDgZwWjdwvqPPbch3Z4DNqoiYPnXn7ttm2WUaWDMo4ofkmBuw4R0gYaODlMz4D9uz-2w/exec';
const posAPI = new POSAPI(API_URL);

// Test connection on load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Testing API connection...');
    const config = await posAPI.getSystemConfig();
    console.log('API connected successfully:', config);
  } catch (error) {
    console.error('API connection failed:', error);
    showToast('Cannot connect to server. Please check your internet connection.', 'error');
  }
});
