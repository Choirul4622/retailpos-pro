// ============================================
// API WRAPPER FOR GOOGLE APPS SCRIPT
// Menggunakan Fetch API murni
// ============================================

class POSAPI {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  async call(action, data = {}) {
    try {
      console.log(`📡 API Call: ${action}`, data);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ API Response (${action}):`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ API Error (${action}):`, error);
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

// Initialize API
const posAPI = new POSAPI(CONFIG.API_URL);

// Test connection on load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🔌 Testing API connection...');
    const config = await posAPI.getSystemConfig();
    console.log('✅ API connected successfully:', config);
    document.getElementById('systemVersion').textContent = `v${config.VERSION} • Online`;
  } catch (error) {
    console.error('❌ API connection failed:', error);
    document.getElementById('systemVersion').textContent = 'v4.0 • Offline';
    showToast('Cannot connect to server. Please check your internet connection.', 'error');
  }
});
