// ============================================
// MAIN APPLICATION - SUPERMARKET POS
// ============================================

// Global Variables
let currentCart = [];
let currentUser = 'Guest';
let allProducts = [];
let cartDiscount = { amount: 0, type: 'amount' };
let productDiscounts = {};
let lastCalculatedTotal = 0;
let salesChart = null;
let categoryChart = null;
let currentEditingProductId = null;
let systemSettings = {};
let transactionLimit = 10;
let transactionOffset = 0;
let dashboardData = null;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
  loadUserInfo();
  initializeSystem();
  setupEventListeners();
  setupKeyboardShortcuts();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(loadDashboardData, 30000);
  checkForDraftCart();
});

async function initializeSystem() {
  showLoading();
  try {
    const result = await posAPI.initializeDatabase();
    hideLoading();
    if (result.success) {
      showToast('System initialized successfully', 'success');
      loadDashboardData();
      loadProductsForPOS();
      loadSettingsFromServer();
    } else {
      showToast('System initialization failed: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('System error: ' + error.message, 'error');
  }
}

async function loadSettingsFromServer() {
  try {
    const config = await posAPI.getSystemConfig();
    systemSettings = config;
    document.getElementById('systemVersion').textContent = `v${config.VERSION} • Ready`;
    document.getElementById('systemVersionInfo').textContent = config.VERSION;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function checkForDraftCart() {
  const draft = localStorage.getItem('posCartDraft');
  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      const savedTime = new Date(parsed.timestamp).toLocaleString();
      if (confirm(`Found a saved cart from ${savedTime}. Load it?`)) {
        loadDraftCart();
      }
    } catch (e) {
      console.error('Failed to parse draft:', e);
    }
  }
}

// ========== UTILITY FUNCTIONS ==========
function formatCurrency(amount) {
  if (isNaN(amount)) amount = 0;
  return 'Rp ' + parseFloat(amount).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function escapeString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function getStockBadgeClass(stock, minStock) {
  if (stock === undefined || stock === null) return 'badge-in-stock';
  if (stock <= 0) return 'badge-out-stock';
  if (stock <= minStock) return 'badge-low-stock';
  return 'badge-in-stock';
}

function getStockBadgeText(stock, minStock) {
  if (stock === undefined || stock === null) return 'IN STOCK';
  if (stock <= 0) return 'OUT OF STOCK';
  if (stock <= minStock) return 'LOW STOCK';
  return 'IN STOCK';
}

function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toastId = 'toast-' + Date.now();
  
  const iconMap = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = toastId;
  toast.innerHTML = `
    <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => {
      const toastToRemove = document.getElementById(toastId);
      if (toastToRemove) {
        toastToRemove.remove();
      }
    }, 300);
  }, 4000);
}

function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
  document.getElementById('currentTime').textContent = timeStr;
}

// ========== SETUP FUNCTIONS ==========
function setupEventListeners() {
  document.getElementById('productSearch').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performProductSearch(this.value);
    }
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
  
  document.getElementById('productSearch').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && this.value.trim().length > 0) {
      handleBarcodeScan(e);
    }
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      if (document.getElementById('productSearch')) {
        document.getElementById('productSearch').focus();
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      clearCart();
    } else if (e.key === 'F4') {
      e.preventDefault();
      if (document.getElementById('paymentAmount')) {
        document.getElementById('paymentAmount').focus();
      }
    } else if (e.key === 'F5') {
      e.preventDefault();
      clearCart();
      showPage('pos');
    } else if (e.key === 'F6') {
      e.preventDefault();
      showDiscountModal();
    } else if (e.key === 'F7') {
      e.preventDefault();
      if (currentCart.length > 0) {
        currentCart.pop();
        updateCartDisplay();
        calculateCartTotals();
        showToast('Last item removed', 'warning');
      }
    }
    
    if (e.ctrlKey) {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        printReceipt();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!document.getElementById('posPage').classList.contains('hidden')) {
          saveCartAsDraft();
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        showAddProductModal();
      }
    }
  });
}

function handleBarcodeScan(event) {
  const barcode = event.target.value.trim();
  if (barcode.length > 0) {
    const product = allProducts.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product.id, product.name, product.sellingPrice, product.stock);
      event.target.value = '';
      event.target.focus();
    } else {
      showToast('Product not found with barcode: ' + barcode, 'warning');
    }
  }
}

// ========== USER MANAGEMENT ==========
async function loadUserInfo() {
  try {
    currentUser = await posAPI.getCurrentUser();
    document.getElementById('currentUser').textContent = currentUser;
  } catch (error) {
    console.error('Failed to load user:', error);
  }
}

// ========== PAGE NAVIGATION ==========
function showPage(page) {
  document.querySelectorAll('.page-content').forEach(el => {
    el.classList.add('hidden');
  });
  
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
  });
  
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item, index) => {
    const text = item.textContent || item.innerText;
    if (text.toLowerCase().includes(page.toLowerCase())) {
      item.classList.add('active');
    }
  });
  
  document.getElementById('loading').classList.remove('hidden');
  
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
    const pageElement = document.getElementById(page + 'Page');
    if (pageElement) {
      pageElement.classList.remove('hidden');
    }
    
    switch(page) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'pos':
        setTimeout(() => {
          document.getElementById('productSearch').focus();
        }, 100);
        loadProductsForPOS();
        break;
      case 'inventory':
        loadInventoryData();
        break;
      case 'products':
        loadProductManagement();
        break;
      case 'reports':
        loadReportsData();
        break;
      case 'settings':
        loadSettings();
        break;
    }
  }, 300);
}

// ========== DASHBOARD FUNCTIONS ==========
async function loadDashboardData() {
  const refreshBtn = document.getElementById('refreshDashboardBtn');
  const originalHtml = refreshBtn.innerHTML;
  refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
  refreshBtn.disabled = true;
  
  showLoading();
  
  try {
    const data = await posAPI.getDashboardData();
    hideLoading();
    
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    
    if (data.success) {
      dashboardData = data;
      updateDashboardUI(data);
      updateLastUpdatedTime();
    } else {
      showToast('Failed to load dashboard data: ' + data.error, 'error');
    }
  } catch (error) {
    hideLoading();
    refreshBtn.innerHTML = originalHtml;
    refreshBtn.disabled = false;
    showToast('Error loading dashboard: ' + error.message, 'error');
  }
}

function refreshDashboard() {
  loadDashboardData();
}

function updateDashboardUI(data) {
  document.getElementById('todaySales').textContent = formatCurrency(data.todaySales || 0);
  document.getElementById('todayTransactions').textContent = `${data.todayTransactions || 0} transactions today`;
  document.getElementById('totalTransactions').textContent = data.todayTransactions || 0;
  document.getElementById('avgTransaction').textContent = `Avg: ${formatCurrency(data.avgTransaction || 0)}`;
  document.getElementById('totalProducts').textContent = data.totalProducts || 0;
  document.getElementById('inventoryValue').textContent = `Value: ${formatCurrency(data.totalValue || 0)}`;
  
  const totalAlerts = (data.lowStockCount || 0) + (data.outOfStockCount || 0);
  document.getElementById('stockAlerts').textContent = totalAlerts;
  document.getElementById('alertDetails').textContent = `${data.lowStockCount || 0} low, ${data.outOfStockCount || 0} out`;
  
  updateSalesChart(data.salesChartData || []);
  updateCategoryChart(data.categoryData || []);
  updateRecentTransactionsTable(data.recentTransactions || []);
  updateStockAlertsTable(data.lowStockProducts || []);
}

function updateSalesChart(chartData) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  
  const chartCtx = ctx.getContext('2d');
  
  if (window.salesChart instanceof Chart) {
    window.salesChart.destroy();
  }
  
  if (!chartData || chartData.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="text-align: center;">
          <i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 20px; display: block; opacity: 0.3;"></i>
          <h4>No sales data</h4>
          <p>Sales data will appear here</p>
        </div>
      </div>
    `;
    return;
  }
  
  const labels = chartData.map(item => item.date);
  const data = chartData.map(item => item.sales);
  
  window.salesChart = new Chart(chartCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Sales',
        data: data,
        borderColor: '#007AFF',
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatCurrency(context.raw);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            },
            font: { size: 11 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function updateCategoryChart(categoryData) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  
  const chartCtx = ctx.getContext('2d');
  
  if (window.categoryChart instanceof Chart) {
    window.categoryChart.destroy();
  }
  
  if (!categoryData || categoryData.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="text-align: center;">
          <i class="fas fa-chart-pie" style="font-size: 48px; margin-bottom: 20px; display: block; opacity: 0.3;"></i>
          <h4>No category data</h4>
          <p>Sales data will appear here</p>
        </div>
      </div>
    `;
    return;
  }
  
  const colors = [
    '#007AFF', '#34C759', '#FF9500', '#FF2D55', '#5856D6',
    '#FFCC00', '#5AC8FA', '#FF3B30', '#8E8E93', '#AF52DE'
  ];
  
  window.categoryChart = new Chart(chartCtx, {
    type: 'doughnut',
    data: {
      labels: categoryData.map(item => item.category),
      datasets: [{
        data: categoryData.map(item => item.sales),
        backgroundColor: colors.slice(0, categoryData.length),
        borderWidth: 1,
        borderColor: '#FFFFFF',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = Math.round((value / total) * 100);
              return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });
}

function updateRecentTransactionsTable(transactions) {
  const tbody = document.getElementById('recentTransactionsBody');
  
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 40px; color: var(--macos-gray-4);">
          <i class="fas fa-receipt" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
          No transactions today
        </td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  transactions.slice(0, 10).forEach(transaction => {
    const statusColor = transaction.status === 'COMPLETED' ? '#34C759' : '#FF9500';
    const time = new Date(transaction.time).toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    html += `
      <tr>
        <td>${time}</td>
        <td><span style="font-family: monospace; font-size: 11px;">${transaction.id.substring(0, 12)}...</span></td>
        <td>${formatCurrency(transaction.total)}</td>
        <td><span class="status-indicator" style="background-color: ${statusColor}"></span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

function updateStockAlertsTable(products) {
  const tbody = document.getElementById('stockAlertsBody');
  
  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center" style="padding: 40px; color: var(--macos-gray-4);">
          <i class="fas fa-check-circle" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
          All products in stock
        </td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  products.slice(0, 10).forEach(product => {
    const isOutOfStock = product.stock === 0;
    const stockClass = isOutOfStock ? 'badge-out-stock' : 'badge-low-stock';
    const stockText = isOutOfStock ? 'OUT' : 'LOW';
    
    html += `
      <tr>
        <td>
          <div style="font-weight: 600; font-size: 13px;">${product.name}</div>
          <div style="font-size: 11px; color: var(--macos-gray-4);">${product.category}</div>
         </div></td>
        <td><strong>${product.stock}</strong></td>
        <td>${product.minStock || 10}</td>
        <td><span class="product-badge ${stockClass}">${stockText}</span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

function updateLastUpdatedTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('lastUpdatedTime').textContent = timeStr;
}

// ========== POS FUNCTIONS ==========
function searchProductsPOS(event) {
  const query = document.getElementById('productSearch').value.trim();
  
  if (event.key === 'Enter') {
    performProductSearch(query);
  } else {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      performProductSearch(query);
    }, 300);
  }
}

async function performProductSearch(query) {
  showLoading();
  try {
    const products = await posAPI.searchProducts(query);
    hideLoading();
    displayProductsPOS(products);
  } catch (error) {
    hideLoading();
    showToast('Search error: ' + error.message, 'error');
  }
}

async function loadProductsForPOS() {
  showLoading();
  try {
    const products = await posAPI.searchProducts('');
    hideLoading();
    allProducts = products;
    displayProductsPOS(products);
  } catch (error) {
    hideLoading();
    showToast('Failed to load products: ' + error.message, 'error');
  }
}

function displayProductsPOS(products) {
  const productGrid = document.getElementById('productGridPOS');
  
  if (!products || products.length === 0) {
    productGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 40px; color: #8E8E93;">
        <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
        <h4>No products found</h4>
        <p>Try a different search term or add new products</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  products.forEach(product => {
    const badgeClass = getStockBadgeClass(product.stock, product.minStock);
    const badgeText = getStockBadgeText(product.stock, product.minStock);
    const isOutOfStock = product.stock <= 0;
    
    const clickHandler = isOutOfStock ? '' : `onclick="addToCart('${product.id}', '${escapeString(product.name)}', ${product.sellingPrice}, ${product.stock || 0})"`;
    
    html += `
      <div class="product-card" ${clickHandler} ${isOutOfStock ? 'style="opacity: 0.7; cursor: not-allowed;"' : ''}>
        <span class="product-badge ${badgeClass}">${badgeText}</span>
        <div class="product-name">${product.name}</div>
        <div class="product-price">${formatCurrency(product.sellingPrice)}</div>
        <div class="product-meta">
          <span>Stock: ${product.stock || 0}</span>
          <span>•</span>
          <span>${product.category || 'Uncategorized'}</span>
        </div>
        ${product.barcode ? `<div class="product-meta"><span>${product.barcode}</span></div>` : ''}
      </div>
    `;
  });
  
  productGrid.innerHTML = html;
}

function addToCart(productId, productName, unitPrice, availableStock) {
  if (availableStock <= 0) {
    showToast('This product is out of stock', 'warning');
    return;
  }
  
  const existingItemIndex = currentCart.findIndex(item => item.productId === productId);
  
  if (existingItemIndex > -1) {
    if (currentCart[existingItemIndex].quantity >= availableStock) {
      showToast(`Only ${availableStock} units available in stock`, 'warning');
      return;
    }
    currentCart[existingItemIndex].quantity += 1;
  } else {
    currentCart.push({
      productId: productId,
      productName: productName,
      unitPrice: unitPrice,
      quantity: 1,
      discountPercent: 0,
      discountAmount: 0
    });
  }
  
  updateCartDisplay();
  calculateCartTotals();
  showToast('Product added to cart', 'success');
  
  document.getElementById('productSearch').value = '';
  document.getElementById('productSearch').focus();
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const cartItemCount = document.getElementById('cartItemCount');
  
  const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
  cartItemCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
  
  if (currentCart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-shopping-cart"></i>
        <h4>Cart is Empty</h4>
        <p>Add products from the left panel</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  currentCart.forEach((item, index) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = productDiscounts[item.productId] 
      ? (productDiscounts[item.productId].type === 'percent' 
        ? (itemSubtotal * productDiscounts[item.productId].amount) / 100 
        : productDiscounts[item.productId].amount)
      : 0;
    
    const itemTotal = itemSubtotal - itemDiscount;
    
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.productName}</div>
          <div class="cart-item-details">
            ${formatCurrency(item.unitPrice)} × ${item.quantity}
            ${itemDiscount > 0 ? `<br><span style="color: #34C759; font-size: 11px;">Discount: ${formatCurrency(itemDiscount)}</span>` : ''}
          </div>
        </div>
        <div class="cart-item-actions">
          <div class="quantity-control">
            <button class="qty-btn" onclick="updateCartQuantity(${index}, -1)">-</button>
            <span style="min-width: 30px; text-align: center; font-weight: 600;">${item.quantity}</span>
            <button class="qty-btn" onclick="updateCartQuantity(${index}, 1)">+</button>
          </div>
          <div class="cart-item-total">
            ${itemDiscount > 0 ? `
              <div style="text-decoration: line-through; color: #8E8E93; font-size: 12px;">
                ${formatCurrency(itemSubtotal)}
              </div>
            ` : ''}
            <div style="color: #34C759;">
              ${formatCurrency(itemTotal)}
            </div>
          </div>
          <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #FF3B30; cursor: pointer; padding: 8px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  cartItems.innerHTML = html;
}

function updateCartQuantity(index, change) {
  const newQuantity = currentCart[index].quantity + change;
  
  if (newQuantity <= 0) {
    currentCart.splice(index, 1);
  } else {
    const product = allProducts.find(p => p.id === currentCart[index].productId);
    if (product && newQuantity > (product.stock || 0)) {
      showToast(`Only ${product.stock} units available`, 'warning');
      return;
    }
    currentCart[index].quantity = newQuantity;
  }
  
  updateCartDisplay();
  calculateCartTotals();
}

function removeFromCart(index) {
  currentCart.splice(index, 1);
  updateCartDisplay();
  calculateCartTotals();
  showToast('Item removed from cart', 'warning');
}

function clearCart() {
  if (currentCart.length === 0) {
    showToast('Cart is already empty', 'info');
    return;
  }
  
  if (confirm('Are you sure you want to clear the cart?')) {
    currentCart = [];
    cartDiscount = { amount: 0, type: 'amount' };
    productDiscounts = {};
    updateCartDisplay();
    calculateCartTotals();
    showToast('Cart cleared', 'success');
  }
}

function saveCartAsDraft() {
  if (currentCart.length === 0) {
    showToast('Cart is empty', 'warning');
    return;
  }
  
  localStorage.setItem('posCartDraft', JSON.stringify({
    cart: currentCart,
    discounts: { cartDiscount, productDiscounts },
    timestamp: new Date().toISOString()
  }));
  
  showToast('Cart saved as draft', 'success');
}

function loadDraftCart() {
  const draft = localStorage.getItem('posCartDraft');
  if (!draft) {
    showToast('No saved draft found', 'warning');
    return;
  }
  
  try {
    const parsed = JSON.parse(draft);
    currentCart = parsed.cart || [];
    cartDiscount = parsed.discounts?.cartDiscount || { amount: 0, type: 'amount' };
    productDiscounts = parsed.discounts?.productDiscounts || {};
    updateCartDisplay();
    calculateCartTotals();
    showToast('Draft cart loaded successfully', 'success');
  } catch (e) {
    showToast('Failed to load draft cart', 'error');
  }
}

// ========== PAYMENT FUNCTIONS ==========
function calculateCartTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  
  currentCart.forEach(item => {
    const itemSubtotal = item.unitPrice * item.quantity;
    subtotal += itemSubtotal;
    
    if (productDiscounts[item.productId]) {
      const discount = productDiscounts[item.productId];
      if (discount.type === 'percent') {
        totalDiscount += (itemSubtotal * discount.amount) / 100;
      } else {
        totalDiscount += discount.amount;
      }
    }
  });
  
  if (cartDiscount.amount > 0) {
    if (cartDiscount.type === 'percent') {
      totalDiscount += (subtotal * cartDiscount.amount) / 100;
    } else {
      totalDiscount += cartDiscount.amount;
    }
  }
  
  const taxRate = systemSettings.PPN_RATE || 0.11;
  const tax = (subtotal - totalDiscount) * taxRate;
  const total = subtotal - totalDiscount + tax;
  lastCalculatedTotal = total;
  
  document.getElementById('cartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cartTax').textContent = formatCurrency(tax);
  document.getElementById('cartDiscount').textContent = formatCurrency(totalDiscount);
  document.getElementById('cartTotal').textContent = formatCurrency(total);
  
  calculatePaymentChange();
}

function calculatePaymentChange() {
  const paymentInput = document.getElementById('paymentAmount');
  const total = lastCalculatedTotal;
  const paymentAmount = parseFloat(paymentInput.value) || 0;
  const change = paymentAmount - total;
  
  const changeElement = document.getElementById('cartChange');
  const changeAmountElement = document.getElementById('changeAmount');
  
  if (change >= 0) {
    changeElement.textContent = formatCurrency(change);
    changeElement.style.color = '#34C759';
    changeAmountElement.textContent = formatCurrency(change);
  } else {
    changeElement.textContent = formatCurrency(Math.abs(change)) + ' kurang';
    changeElement.style.color = '#FF3B30';
    changeAmountElement.textContent = formatCurrency(Math.abs(change)) + ' kurang';
  }
  
  if (paymentAmount < total) {
    paymentInput.style.borderColor = '#FF3B30';
    paymentInput.style.backgroundColor = '#FFF2F2';
  } else {
    paymentInput.style.borderColor = '#34C759';
    paymentInput.style.backgroundColor = '#F2FFF4';
  }
}

function setExactPayment() {
  document.getElementById('paymentAmount').value = lastCalculatedTotal;
  calculatePaymentChange();
  showToast('Payment amount set to exact total', 'info');
}

function suggestPaymentAmount() {
  const suggestedAmount = Math.ceil(lastCalculatedTotal / 50000) * 50000;
  document.getElementById('paymentAmount').value = suggestedAmount;
  calculatePaymentChange();
  showToast(`Suggested payment: ${formatCurrency(suggestedAmount)}`, 'info');
}

function addToPayment(amount) {
  const paymentInput = document.getElementById('paymentAmount');
  const currentValue = parseFloat(paymentInput.value) || 0;
  paymentInput.value = currentValue + amount;
  calculatePaymentChange();
}

function clearPayment() {
  document.getElementById('paymentAmount').value = '';
  calculatePaymentChange();
}

// ========== DISCOUNT FUNCTIONS ==========
function showDiscountModal() {
  populateProductDiscountSelect();
  showModal('discountModal');
}

function selectDiscountType(type) {
  document.querySelectorAll('.discount-type-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === type) {
      btn.classList.add('active');
    }
  });
  
  document.getElementById('cartDiscountForm').style.display = type === 'cart' ? 'block' : 'none';
  document.getElementById('productDiscountForm').style.display = type === 'product' ? 'block' : 'none';
}

function populateProductDiscountSelect() {
  const select = document.getElementById('productDiscountSelect');
  select.innerHTML = '<option value="">Select a product...</option>';
  
  if (currentCart.length === 0) {
    select.innerHTML += '<option value="" disabled>No products in cart</option>';
    return;
  }
  
  currentCart.forEach(item => {
    select.innerHTML += `
      <option value="${item.productId}">
        ${item.productName} (${item.quantity} × ${formatCurrency(item.unitPrice)})
      </option>
    `;
  });
}

function applyDiscount() {
  const discountType = document.querySelector('.discount-type-btn.active').dataset.type;
  
  if (discountType === 'cart') {
    const amount = parseFloat(document.getElementById('cartDiscountAmount').value);
    const type = document.getElementById('cartDiscountType').value;
    
    if (!amount || amount <= 0) {
      showToast('Please enter a valid discount amount', 'warning');
      return;
    }
    
    if (type === 'percent' && amount > 100) {
      showToast('Percentage discount cannot exceed 100%', 'warning');
      return;
    }
    
    cartDiscount = { amount, type };
    closeModal('discountModal');
    calculateCartTotals();
    showToast(`Cart discount applied: ${type === 'percent' ? amount + '%' : formatCurrency(amount)}`, 'success');
    
  } else {
    const productId = document.getElementById('productDiscountSelect').value;
    const amount = parseFloat(document.getElementById('productDiscountAmount').value);
    const type = document.getElementById('productDiscountType').value;
    
    if (!productId) {
      showToast('Please select a product', 'warning');
      return;
    }
    
    if (!amount || amount <= 0) {
      showToast('Please enter a valid discount amount', 'warning');
      return;
    }
    
    if (type === 'percent' && amount > 100) {
      showToast('Percentage discount cannot exceed 100%', 'warning');
      return;
    }
    
    const item = currentCart.find(item => item.productId === productId);
    if (!item) {
      showToast('Product not found in cart', 'error');
      return;
    }
    
    const itemSubtotal = item.unitPrice * item.quantity;
    const maxDiscount = type === 'percent' ? 100 : itemSubtotal;
    if (amount > maxDiscount) {
      showToast(`Discount cannot exceed ${type === 'percent' ? '100%' : formatCurrency(itemSubtotal)}`, 'warning');
      return;
    }
    
    productDiscounts[productId] = { amount, type };
    closeModal('discountModal');
    calculateCartTotals();
    showToast(`Discount applied to ${item.productName}`, 'success');
  }
}

// ========== TRANSACTION PROCESSING ==========
async function processTransaction() {
  if (currentCart.length === 0) {
    showToast('Cart is empty! Add products before processing transaction.', 'warning');
    return;
  }
  
  const paymentMethod = document.getElementById('paymentMethod').value;
  const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const total = lastCalculatedTotal;
  
  if (paymentAmount < total) {
    const shortage = total - paymentAmount;
    if (!confirm(`Payment is short by ${formatCurrency(shortage)}. Process anyway?`)) {
      return;
    }
  }
  
  const transactionData = {
    items: currentCart.map(item => {
      const discount = productDiscounts[item.productId];
      return {
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountPercent: discount ? (discount.type === 'percent' ? discount.amount : 0) : 0,
        discountAmount: discount ? (discount.type === 'amount' ? discount.amount : 0) : 0
      };
    }),
    paymentMethod: paymentMethod,
    paymentAmount: paymentAmount,
    discount: calculateTotalDiscount()
  };
  
  showLoading();
  
  try {
    const result = await posAPI.createTransaction(transactionData);
    hideLoading();
    
    if (result.success) {
      showReceipt(result.receipt, result.transactionId);
      
      currentCart = [];
      cartDiscount = { amount: 0, type: 'amount' };
      productDiscounts = {};
      updateCartDisplay();
      calculateCartTotals();
      document.getElementById('productSearch').value = '';
      document.getElementById('paymentAmount').value = '';
      loadProductsForPOS();
      loadDashboardData();
      
      localStorage.removeItem('posCartDraft');
      
      showToast(`Transaction ${result.transactionId} completed successfully!`, 'success');
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Transaction failed: ' + error.message, 'error');
  }
}

function calculateTotalDiscount() {
  let totalDiscount = 0;
  let subtotal = 0;
  
  currentCart.forEach(item => {
    const itemSubtotal = item.unitPrice * item.quantity;
    subtotal += itemSubtotal;
    
    if (productDiscounts[item.productId]) {
      const discount = productDiscounts[item.productId];
      if (discount.type === 'percent') {
        totalDiscount += (itemSubtotal * discount.amount) / 100;
      } else {
        totalDiscount += discount.amount;
      }
    }
  });
  
  if (cartDiscount.amount > 0) {
    if (cartDiscount.type === 'percent') {
      totalDiscount += (subtotal * cartDiscount.amount) / 100;
    } else {
      totalDiscount += cartDiscount.amount;
    }
  }
  
  return totalDiscount;
}

function showReceipt(receiptText, transactionId) {
  const receiptContent = document.getElementById('receiptContent');
  receiptContent.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #007AFF;">SUPERMARKET POS</h3>
        <p style="margin: 5px 0; font-size: 12px;">${systemSettings.COMPANY_NAME || 'POS System'}</p>
        <p style="margin: 5px 0; font-size: 11px;">Transaction ID: ${transactionId}</p>
      </div>
      <div style="border-top: 1px dashed #ccc; padding-top: 10px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.4;">
        ${receiptText.replace(/\n/g, '<br>')}
      </div>
      <div style="border-top: 1px dashed #ccc; margin-top: 20px; padding-top: 10px; text-align: center; font-size: 11px; color: #666;">
        ${document.getElementById('receiptFooter').value || 'Thank you for shopping with us!'}
      </div>
    </div>
  `;
  showModal('receiptModal');
}

// ========== RECEIPT FUNCTIONS ==========
function printReceipt() {
  const printContent = document.getElementById('receiptContent').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt - Supermarket POS</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px;
            line-height: 1.4;
            padding: 20px;
            max-width: 300px;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 20px; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          .total { font-weight: bold; font-size: 14px; }
          .thank-you { text-align: center; margin-top: 20px; font-style: italic; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function emailReceipt() {
  showToast('Email receipt feature coming soon!', 'info');
}

// ========== INVENTORY FUNCTIONS ==========
async function loadInventoryData() {
  showLoading();
  try {
    const data = await posAPI.getInventorySummary();
    hideLoading();
    if (data.success) {
      updateInventoryUI(data);
    } else {
      showToast('Failed to load inventory: ' + data.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Error loading inventory: ' + error.message, 'error');
  }
}

function updateInventoryUI(data) {
  const inventoryStats = document.getElementById('inventoryStats');
  const lowStockCount = data.products ? data.products.filter(p => p.status === 'LOW_STOCK').length : 0;
  const outOfStockCount = data.products ? data.products.filter(p => p.status === 'OUT_OF_STOCK').length : 0;
  
  inventoryStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label"><i class="fas fa-boxes"></i> TOTAL PRODUCTS</div>
      <div class="stat-value">${data.totalProducts || 0}</div>
      <div class="stat-change">In inventory</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><i class="fas fa-money-bill-wave"></i> TOTAL VALUE</div>
      <div class="stat-value">${formatCurrency(data.totalValue || 0)}</div>
      <div class="stat-change">Current inventory value</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><i class="fas fa-exclamation-triangle"></i> LOW STOCK</div>
      <div class="stat-value">${lowStockCount}</div>
      <div class="stat-change">Products need restock</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><i class="fas fa-times-circle"></i> OUT OF STOCK</div>
      <div class="stat-value">${outOfStockCount}</div>
      <div class="stat-change">Products unavailable</div>
    </div>
  `;
  
  updateInventoryTable(data.products || []);
}

async function searchInventory() {
  const query = document.getElementById('inventorySearch').value;
  try {
    const products = await posAPI.searchProducts(query);
    updateInventoryTable(products);
  } catch (error) {
    showToast('Search failed: ' + error.message, 'error');
  }
}

function updateInventoryTable(products) {
  const tbody = document.getElementById('inventoryTableBody');
  
  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 60px; color: #8E8E93;">
          <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
          <h4>No products in inventory</h4>
          <p>Add products to get started</p>
         </div></td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  products.forEach(product => {
    const badgeClass = getStockBadgeClass(product.stock, product.minStock);
    const badgeText = getStockBadgeText(product.stock, product.minStock);
    
    html += `
      <tr>
        <td><strong>${product.id}</strong></td>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td><strong>${product.stock}</strong></td>
        <td>${product.minStock || 10}</td>
        <td>${formatCurrency(product.sellingPrice)}</td>
        <td>${formatCurrency(product.value || 0)}</td>
        <td><span class="product-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editProduct('${product.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-success" onclick="quickRestock('${product.id}', '${escapeString(product.name)}')">
            <i class="fas fa-plus"></i>
          </button>
         </div></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

function exportInventory() {
  showToast('Export feature coming soon!', 'info');
}

function showBulkRestockModal() {
  showToast('Bulk restock feature coming soon!', 'info');
}

async function quickRestock(productId, productName) {
  const quantity = prompt(`Enter quantity to add to ${productName}:`, "10");
  if (quantity && !isNaN(quantity) && parseInt(quantity) > 0) {
    showLoading();
    try {
      const result = await posAPI.updateStock(productId, parseInt(quantity), 'RESTOCK', 'Quick restock');
      hideLoading();
      if (result.success) {
        showToast(`Added ${quantity} units to ${productName}`, 'success');
        loadInventoryData();
        loadProductManagement();
        loadProductsForPOS();
      } else {
        showToast('Error: ' + result.error, 'error');
      }
    } catch (error) {
      hideLoading();
      showToast('Error: ' + error.message, 'error');
    }
  }
}

// ========== PRODUCT MANAGEMENT ==========
async function loadProductManagement() {
  showLoading();
  try {
    const products = await posAPI.searchProducts('');
    hideLoading();
    updateProductManagementTable(products);
  } catch (error) {
    hideLoading();
    showToast('Error loading products: ' + error.message, 'error');
  }
}

function updateProductManagementTable(products) {
  const tbody = document.getElementById('productManagementBody');
  
  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center" style="padding: 60px; color: #8E8E93;">
          <i class="fas fa-cube" style="font-size: 48px; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
          <h4>No products found</h4>
          <p>Add your first product to get started</p>
         </div></td>
      </tr>
    `;
    return;
  }
  
  let html = '';
  products.forEach(product => {
    const badgeClass = getStockBadgeClass(product.stock, product.minStock);
    const badgeText = getStockBadgeText(product.stock, product.minStock);
    
    html += `
      <tr>
        <td><code>${product.barcode || 'N/A'}</code></td>
        <td><strong>${product.name}</strong></td>
        <td>${product.category || 'Uncategorized'}</td>
        <td>${formatCurrency(product.purchasePrice || 0)}</td>
        <td>${formatCurrency(product.sellingPrice)}</td>
        <td><strong>${product.stock || 0}</strong></td>
        <td><span class="product-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editProduct('${product.id}')">
            <i class="fas fa-edit"></i>
          </button>
         </div></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

async function searchProductManagement() {
  const query = document.getElementById('productManagementSearch').value;
  try {
    const products = await posAPI.searchProducts(query);
    updateProductManagementTable(products);
  } catch (error) {
    showToast('Search failed: ' + error.message, 'error');
  }
}

function exportProducts() {
  showToast('Export feature coming soon!', 'info');
}

function showImportModal() {
  showModal('importModal');
}

function importCSV() {
  showToast('CSV import feature coming soon!', 'info');
}

// ========== PRODUCT CRUD OPERATIONS ==========
function showAddProductModal() {
  document.getElementById('addProductForm').reset();
  document.getElementById('productBarcode').value = '';
  document.getElementById('productStock').value = 0;
  showModal('addProductModal');
}

async function saveProduct() {
  const productData = {
    barcode: document.getElementById('productBarcode').value.trim(),
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value,
    purchasePrice: document.getElementById('productPurchasePrice').value,
    sellingPrice: document.getElementById('productSellingPrice').value,
    stock: document.getElementById('productStock').value,
    minStock: document.getElementById('productMinStock').value,
    description: document.getElementById('productDescription').value
  };
  
  if (!productData.name) {
    showToast('Product name is required', 'warning');
    document.getElementById('productName').focus();
    return;
  }
  
  if (!productData.sellingPrice || parseFloat(productData.sellingPrice) <= 0) {
    showToast('Valid selling price is required', 'warning');
    document.getElementById('productSellingPrice').focus();
    return;
  }
  
  showLoading();
  
  try {
    const result = await posAPI.addProduct(productData);
    hideLoading();
    if (result.success) {
      showToast('Product added successfully!', 'success');
      closeModal('addProductModal');
      document.getElementById('addProductForm').reset();
      
      loadInventoryData();
      loadProductManagement();
      loadProductsForPOS();
      loadDashboardData();
    } else {
      showToast('Error adding product: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Failed to add product: ' + error.message, 'error');
  }
}

function editProduct(productId) {
  currentEditingProductId = productId;
  
  const product = allProducts.find(p => p.id === productId);
  if (!product) {
    showToast('Product not found', 'error');
    return;
  }
  
  document.getElementById('editProductId').value = productId;
  document.getElementById('editBarcode').value = product.barcode || '';
  document.getElementById('editName').value = product.name;
  document.getElementById('editCategory').value = product.category || 'Other';
  document.getElementById('editPurchasePrice').value = product.purchasePrice || 0;
  document.getElementById('editSellingPrice').value = product.sellingPrice;
  document.getElementById('editStock').value = product.stock || 0;
  document.getElementById('editMinStock').value = product.minStock || 10;
  document.getElementById('editAddStock').value = 0;
  
  showModal('editProductModal');
}

async function updateProduct() {
  const productId = document.getElementById('editProductId').value;
  const addStock = parseInt(document.getElementById('editAddStock').value) || 0;
  
  if (addStock > 0) {
    showLoading();
    try {
      const result = await posAPI.updateStock(productId, addStock, 'RESTOCK', 'Manual restock');
      hideLoading();
      if (result.success) {
        showToast(`Added ${addStock} units to stock`, 'success');
        closeModal('editProductModal');
        loadInventoryData();
        loadProductManagement();
        loadProductsForPOS();
      } else {
        showToast('Error updating stock: ' + result.error, 'error');
      }
    } catch (error) {
      hideLoading();
      showToast('Error: ' + error.message, 'error');
    }
  } else {
    closeModal('editProductModal');
  }
}

function deleteProduct() {
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
    return;
  }
  showToast('Delete feature coming soon!', 'info');
}

// ========== REPORTS FUNCTIONS ==========
function loadReportsData() {
  showToast('Reports feature coming soon!', 'info');
}

function generateDailyReport() {
  showToast('Generating daily report...', 'info');
}

function generateSalesReport() {
  showToast('Generating sales report...', 'info');
}

function exportReport() {
  showToast('Export report feature coming soon!', 'info');
}

// ========== SETTINGS FUNCTIONS ==========
function loadSettings() {
  showToast('Settings feature coming soon!', 'info');
}

function saveSettings() {
  const settings = {
    companyName: document.getElementById('companyName').value,
    taxRate: parseFloat(document.getElementById('taxRate').value) / 100,
    minStockAlert: parseInt(document.getElementById('minStockAlert').value),
    receiptFooter: document.getElementById('receiptFooter').value
  };
  
  localStorage.setItem('posSettings', JSON.stringify(settings));
  showToast('Settings saved locally', 'success');
}

async function backupData() {
  showLoading();
  try {
    const result = await posAPI.backupData();
    hideLoading();
    if (result.success) {
      showToast('Backup created successfully!', 'success');
      document.getElementById('lastBackup').textContent = new Date().toLocaleString();
    } else {
      showToast('Backup failed: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Backup failed: ' + error.message, 'error');
  }
}

async function cleanupData() {
  if (confirm('This will cleanup empty rows. Continue?')) {
    showLoading();
    try {
      const result = await posAPI.cleanupEmptyRows();
      hideLoading();
      showToast(result.message, 'success');
    } catch (error) {
      hideLoading();
      showToast('Cleanup failed: ' + error.message, 'error');
    }
  }
}

async function testSystem() {
  showLoading();
  try {
    const result = await posAPI.testSystem();
    hideLoading();
    if (result.success) {
      const passed = result.summary.passed;
      const total = result.summary.total;
      showToast(`System test passed: ${passed}/${total} tests`, 'success');
    } else {
      showToast('System test failed: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Test failed: ' + error.message, 'error');
  }
}

function resetSystem() {
  if (confirm('WARNING: This will reset the system to factory defaults. All data will be lost. Continue?')) {
    showToast('System reset feature coming soon!', 'info');
  }
}

// ========== QUICK ACTIONS ==========
function showQuickActions() {
  showModal('quickActionsModal');
}

function quickAction(action) {
  closeModal('quickActionsModal');
  
  switch(action) {
    case 'voidItem':
      if (currentCart.length > 0) {
        currentCart.pop();
        updateCartDisplay();
        calculateCartTotals();
        showToast('Last item voided', 'warning');
      } else {
        showToast('No items to void', 'warning');
      }
      break;
      
    case 'priceOverride':
      showToast('Price override feature coming soon!', 'info');
      break;
      
    case 'holdTransaction':
      saveCartAsDraft();
      break;
      
    case 'recallTransaction':
      loadDraftCart();
      break;
      
    case 'splitPayment':
      showToast('Split payment feature coming soon!', 'info');
      break;
      
    case 'noSale':
      if (confirm('Open cash drawer without sale?')) {
        showToast('Cash drawer opened', 'info');
      }
      break;
  }
}
