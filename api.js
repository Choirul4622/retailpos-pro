// ============================================
// API WRAPPER FOR GOOGLE APPS SCRIPT
// ============================================

class POSAPI {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async call(action, data = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      });
      
      // Karena mode 'no-cors', kita perlu menggunakan pendekatan berbeda
      // Kita akan menggunakan Google Apps Script sebagai proxy
      return await this.proxyCall(action, data);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async proxyCall(action, data) {
    // Menggunakan Google Apps Script Execution API
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        [action](data);
    });
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

// Initialize API
const posAPI = new POSAPI(CONFIG.API_URL);
