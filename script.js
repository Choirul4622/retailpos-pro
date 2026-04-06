// ============================================
// MAIN APPLICATION - SUPERMARKET POS
// ============================================

// Global Variables
let currentCart = [];
let currentUser = 'Guest';
let allProducts = [];
let cartDiscount = { amount: 0, type: 'amount' };
let lastCalculatedTotal = 0;
let salesChart = null;
let categoryChart = null;

// ========== UTILITY FUNCTIONS ==========
function formatCurrency(amount) {
  if (isNaN(amount)) amount = 0;
  return 'Rp ' + parseFloat(amount).toLocaleString('id-ID');
}

function escapeString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function getStockBadgeClass(stock, minStock) {
  if (stock <= 0) return 'badge-out-stock';
  if (stock <= minStock) return 'badge-low-stock';
  return 'badge-in-stock';
}

function getStockBadgeText(stock, minStock) {
  if (stock <= 0) return 'OUT';
  if (stock <= minStock) return 'LOW';
  return 'OK';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 4000);
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
  document.getElementById('currentTime').textContent = now.toLocaleTimeString('id-ID');
}

// ========== PAGE NAVIGATION ==========
function showPage(page) {
  document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  const targetPage = document.getElementById(page + 'Page');
  if (targetPage) targetPage.classList.remove('hidden');
  
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.innerText.toLowerCase().includes(page.toLowerCase())) {
      item.classList.add('active');
    }
  });
  
  if (page === 'dashboard') loadDashboardData();
  if (page === 'pos') { loadProductsForPOS(); setTimeout(() => document.getElementById('productSearch')?.focus(), 100); }
  if (page === 'inventory') loadInventoryData();
  if (page === 'products') loadProductManagement();
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);
  await loadUserInfo();
  await initializeSystem();
  setupEventListeners();
});

async function loadUserInfo() {
  try {
    currentUser = await posAPI.getCurrentUser();
    document.getElementById('currentUser').textContent = currentUser;
  } catch (error) {
    console.error('Failed to load user:', error);
    document.getElementById('currentUser').textContent = 'Guest User';
  }
}

async function initializeSystem() {
  showLoading();
  try {
    const config = await posAPI.getSystemConfig();
    console.log('API connected:', config);
    const result = await posAPI.initializeDatabase();
    hideLoading();
    if (result.success) {
      showToast('System initialized successfully', 'success');
      loadDashboardData();
      loadProductsForPOS();
    } else {
      showToast('Init failed: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Cannot connect to server', 'error');
  }
}

// ========== DASHBOARD ==========
async function loadDashboardData() {
  showLoading();
  try {
    const data = await posAPI.getDashboardData();
    hideLoading();
    if (data.success) {
      document.getElementById('todaySales').textContent = formatCurrency(data.todaySales || 0);
      document.getElementById('totalTransactions').textContent = data.todayTransactions || 0;
      document.getElementById('totalProducts').textContent = data.totalProducts || 0;
      document.getElementById('stockAlerts').textContent = (data.lowStockCount || 0) + (data.outOfStockCount || 0);
      updateSalesChart(data.salesChartData || []);
      updateRecentTable(data.recentTransactions || []);
      updateAlertsTable(data.lowStockProducts || []);
    }
  } catch (error) {
    hideLoading();
    showToast('Failed to load dashboard', 'error');
  }
}

function refreshDashboard() { loadDashboardData(); }

function updateSalesChart(chartData) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;
  if (salesChart) salesChart.destroy();
  if (!chartData.length) return;
  
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map(d => d.date),
      datasets: [{ label: 'Sales', data: chartData.map(d => d.sales), borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.1)', fill: true, tension: 0.4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } } } }
  });
}

function updateRecentTable(transactions) {
  const tbody = document.getElementById('recentTransactionsBody');
  if (!transactions.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center">No transactions</td></tr>'; return; }
  tbody.innerHTML = transactions.slice(0, 10).map(t => `<tr><td>${t.time}</td><td>${t.id?.substring(0,12)}...</td><td>${formatCurrency(t.total)}</td><td>${t.status}</td></tr>`).join('');
}

function updateAlertsTable(products) {
  const tbody = document.getElementById('stockAlertsBody');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center">All products in stock</td></tr>'; return; }
  tbody.innerHTML = products.slice(0, 10).map(p => `<tr><td>${p.name}</td><td><strong>${p.stock}</strong></td><td>${p.minStock}</td><td><span class="product-badge ${getStockBadgeClass(p.stock, p.minStock)}">${getStockBadgeText(p.stock, p.minStock)}</span></td></tr>`).join('');
}

// ========== POS FUNCTIONS ==========
async function loadProductsForPOS() {
  showLoading();
  try {
    const products = await posAPI.searchProducts('');
    hideLoading();
    allProducts = products;
    displayProductsPOS(products);
  } catch (error) {
    hideLoading();
    showToast('Failed to load products', 'error');
  }
}

function searchProductsPOS(event) {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(async () => {
    const query = document.getElementById('productSearch').value;
    showLoading();
    try {
      const products = await posAPI.searchProducts(query);
      hideLoading();
      displayProductsPOS(products);
    } catch (error) {
      hideLoading();
    }
  }, 300);
}

function displayProductsPOS(products) {
  const grid = document.getElementById('productGridPOS');
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h4>No products found</h4></div>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="product-card" onclick="addToCart('${p.id}', '${escapeString(p.name)}', ${p.sellingPrice}, ${p.stock})">
      <span class="product-badge ${getStockBadgeClass(p.stock, p.minStock)}">${getStockBadgeText(p.stock, p.minStock)}</span>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${formatCurrency(p.sellingPrice)}</div>
      <div class="product-meta">Stock: ${p.stock || 0} • ${p.category || 'Uncategorized'}</div>
    </div>
  `).join('');
}

function addToCart(id, name, price, stock) {
  if (stock <= 0) { showToast('Out of stock', 'warning'); return; }
  const existing = currentCart.find(i => i.productId === id);
  if (existing) {
    if (existing.quantity >= stock) { showToast(`Only ${stock} available`, 'warning'); return; }
    existing.quantity++;
  } else {
    currentCart.push({ productId: id, productName: name, unitPrice: price, quantity: 1 });
  }
  updateCartDisplay();
  calculateCartTotals();
  showToast('Added to cart', 'success');
  document.getElementById('productSearch').focus();
}

function updateCartDisplay() {
  const container = document.getElementById('cartItems');
  const count = currentCart.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cartItemCount').textContent = `${count} item${count !== 1 ? 's' : ''}`;
  
  if (!currentCart.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-cart"></i><h4>Cart is Empty</h4></div>';
    return;
  }
  
  container.innerHTML = currentCart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.productName}</div>
        <div class="cart-item-details">${formatCurrency(item.unitPrice)} × ${item.quantity}</div>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="qty-btn" onclick="updateQuantity(${idx}, -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity(${idx}, 1)">+</button>
        </div>
        <div class="cart-item-total">${formatCurrency(item.unitPrice * item.quantity)}</div>
        <button onclick="removeFromCart(${idx})" style="background:none;border:none;color:#FF3B30;cursor:pointer"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function updateQuantity(idx, delta) {
  const newQty = currentCart[idx].quantity + delta;
  if (newQty <= 0) currentCart.splice(idx, 1);
  else currentCart[idx].quantity = newQty;
  updateCartDisplay();
  calculateCartTotals();
}

function removeFromCart(idx) {
  currentCart.splice(idx, 1);
  updateCartDisplay();
  calculateCartTotals();
}

function clearCart() {
  if (!currentCart.length) { showToast('Cart empty', 'info'); return; }
  if (confirm('Clear cart?')) {
    currentCart = [];
    cartDiscount = { amount: 0, type: 'amount' };
    updateCartDisplay();
    calculateCartTotals();
    showToast('Cart cleared', 'success');
  }
}

function calculateCartTotals() {
  let subtotal = currentCart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  let discount = cartDiscount.type === 'percent' ? (subtotal * cartDiscount.amount / 100) : cartDiscount.amount;
  let tax = (subtotal - discount) * 0.11;
  let total = subtotal - discount + tax;
  lastCalculatedTotal = total;
  
  document.getElementById('cartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('cartTax').textContent = formatCurrency(tax);
  document.getElementById('cartDiscount').textContent = formatCurrency(discount);
  document.getElementById('cartTotal').textContent = formatCurrency(total);
  calculatePaymentChange();
}

function calculatePaymentChange() {
  const payment = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const change = payment - lastCalculatedTotal;
  const changeEl = document.getElementById('cartChange');
  changeEl.textContent = formatCurrency(Math.abs(change)) + (change < 0 ? ' kurang' : '');
  changeEl.style.color = change >= 0 ? '#34C759' : '#FF3B30';
  document.getElementById('changeAmount').textContent = formatCurrency(Math.abs(change)) + (change < 0 ? ' kurang' : '');
}

function setExactPayment() {
  document.getElementById('paymentAmount').value = lastCalculatedTotal;
  calculatePaymentChange();
}

function addToPayment(amount) {
  const input = document.getElementById('paymentAmount');
  input.value = (parseFloat(input.value) || 0) + amount;
  calculatePaymentChange();
}

function showDiscountModal() {
  document.getElementById('discountAmount').value = '';
  showModal('discountModal');
}

function applyCartDiscount() {
  const amount = parseFloat(document.getElementById('discountAmount').value);
  const type = document.getElementById('discountType').value;
  if (!amount || amount <= 0) { showToast('Invalid amount', 'warning'); return; }
  if (type === 'percent' && amount > 100) { showToast('Max 100%', 'warning'); return; }
  cartDiscount = { amount, type };
  closeModal('discountModal');
  calculateCartTotals();
  showToast(`Discount ${type === 'percent' ? amount + '%' : formatCurrency(amount)} applied`, 'success');
}

function saveCartAsDraft() {
  if (!currentCart.length) { showToast('Cart empty', 'warning'); return; }
  localStorage.setItem('posCartDraft', JSON.stringify({ cart: currentCart, discount: cartDiscount, timestamp: new Date().toISOString() }));
  showToast('Cart saved', 'success');
}

async function processTransaction() {
  if (!currentCart.length) { showToast('Cart empty', 'warning'); return; }
  const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  if (paymentAmount < lastCalculatedTotal && !confirm(`Short by ${formatCurrency(lastCalculatedTotal - paymentAmount)}. Continue?`)) return;
  
  const transactionData = {
    items: currentCart.map(i => ({ productId: i.productId, productName: i.productName, unitPrice: i.unitPrice, quantity: i.quantity, discountPercent: 0, discountAmount: 0 })),
    paymentMethod: document.getElementById('paymentMethod').value,
    paymentAmount: paymentAmount,
    discount: cartDiscount.type === 'percent' ? (currentCart.reduce((s,i)=>s+(i.unitPrice*i.quantity),0) * cartDiscount.amount / 100) : cartDiscount.amount
  };
  
  showLoading();
  try {
    const result = await posAPI.createTransaction(transactionData);
    hideLoading();
    if (result.success) {
      document.getElementById('receiptContent').innerHTML = `<pre style="font-family:monospace">${result.receipt}</pre>`;
      showModal('receiptModal');
      currentCart = [];
      cartDiscount = { amount: 0, type: 'amount' };
      updateCartDisplay();
      calculateCartTotals();
      document.getElementById('paymentAmount').value = '';
      loadProductsForPOS();
      loadDashboardData();
      localStorage.removeItem('posCartDraft');
      showToast(`Transaction ${result.transactionId} complete!`, 'success');
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Transaction failed', 'error');
  }
}

function printReceipt() {
  const content = document.getElementById('receiptContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px}</style></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// ========== INVENTORY FUNCTIONS ==========
async function loadInventoryData() {
  showLoading();
  try {
    const data = await posAPI.getInventorySummary();
    hideLoading();
    if (data.success) {
      const lowCount = data.products?.filter(p => p.status === 'LOW_STOCK').length || 0;
      const outCount = data.products?.filter(p => p.status === 'OUT_OF_STOCK').length || 0;
      document.getElementById('inventoryStats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${data.totalProducts}</div></div>
        <div class="stat-card"><div class="stat-label">Total Value</div><div class="stat-value">${formatCurrency(data.totalValue)}</div></div>
        <div class="stat-card"><div class="stat-label">Low Stock</div><div class="stat-value">${lowCount}</div></div>
        <div class="stat-card"><div class="stat-label">Out of Stock</div><div class="stat-value">${outCount}</div></div>
      `;
      displayInventoryTable(data.products || []);
    }
  } catch (error) {
    hideLoading();
    showToast('Failed to load inventory', 'error');
  }
}

function displayInventoryTable(products) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!products.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products</td></tr>'; return; }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.id}</td><td>${p.name}</td><td>${p.category}</td>
      <td><strong>${p.stock}</strong></td><td>${formatCurrency(p.sellingPrice)}</td>
      <td><span class="product-badge ${getStockBadgeClass(p.stock, p.minStock)}">${p.status}</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button></td>
    </tr>
  `).join('');
}

function searchInventory() {
  const query = document.getElementById('inventorySearch').value;
  posAPI.searchProducts(query).then(products => displayInventoryTable(products)).catch(console.error);
}

// ========== PRODUCT MANAGEMENT ==========
async function loadProductManagement() {
  showLoading();
  try {
    const products = await posAPI.searchProducts('');
    hideLoading();
    const tbody = document.getElementById('productManagementBody');
    if (!products.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products</td></tr>'; return; }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><code>${p.barcode || 'N/A'}</code></td><td><strong>${p.name}</strong></td><td>${p.category}</td>
        <td>${formatCurrency(p.sellingPrice)}</td><td>${p.stock}</td>
        <td><span class="product-badge ${getStockBadgeClass(p.stock, p.minStock)}">${getStockBadgeText(p.stock, p.minStock)}</span></td>
        <td><button class="btn btn-sm btn-secondary" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button></td>
      </tr>
    `).join('');
  } catch (error) {
    hideLoading();
    showToast('Failed to load products', 'error');
  }
}

function searchProductManagement() {
  const query = document.getElementById('productManagementSearch').value;
  posAPI.searchProducts(query).then(products => {
    const tbody = document.getElementById('productManagementBody');
    tbody.innerHTML = products.map(p => `<tr><td>${p.name}</td><td>${formatCurrency(p.sellingPrice)}</td><td><button class="btn btn-sm btn-secondary" onclick="editProduct('${p.id}')">Edit</button></td></tr>`).join('');
  }).catch(console.error);
}

function showAddProductModal() {
  document.getElementById('addProductForm').reset();
  showModal('addProductModal');
}

async function saveProduct() {
  const productData = {
    name: document.getElementById('productName').value,
    barcode: document.getElementById('productBarcode').value,
    category: document.getElementById('productCategory').value,
    sellingPrice: parseFloat(document.getElementById('productSellingPrice').value),
    stock: parseInt(document.getElementById('productStock').value) || 0,
    minStock: parseInt(document.getElementById('productMinStock').value) || 10
  };
  if (!productData.name) { showToast('Product name required', 'warning'); return; }
  if (!productData.sellingPrice) { showToast('Price required', 'warning'); return; }
  
  showLoading();
  try {
    const result = await posAPI.addProduct(productData);
    hideLoading();
    if (result.success) {
      showToast('Product added', 'success');
      closeModal('addProductModal');
      loadProductManagement();
      loadProductsForPOS();
      loadInventoryData();
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Failed to add product', 'error');
  }
}

function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  document.getElementById('editProductId').value = id;
  document.getElementById('editName').value = product.name;
  document.getElementById('editAddStock').value = 0;
  showModal('editProductModal');
}

async function updateProductStock() {
  const id = document.getElementById('editProductId').value;
  const addStock = parseInt(document.getElementById('editAddStock').value) || 0;
  if (addStock <= 0) { closeModal('editProductModal'); return; }
  
  showLoading();
  try {
    const result = await posAPI.updateStock(id, addStock, 'RESTOCK', 'Manual restock');
    hideLoading();
    if (result.success) {
      showToast(`Added ${addStock} units`, 'success');
      closeModal('editProductModal');
      loadProductManagement();
      loadProductsForPOS();
      loadInventoryData();
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Failed to update stock', 'error');
  }
}

function showQuickActions() { showModal('quickActionsModal'); }

// Event Listeners
function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') { e.preventDefault(); document.getElementById('productSearch')?.focus(); }
    if (e.key === 'F3') { e.preventDefault(); clearCart(); }
    if (e.key === 'F5') { e.preventDefault(); clearCart(); showPage('pos'); }
  });
}
