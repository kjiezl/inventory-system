let currentSection = null;

function initializeDashboard() {
    updateUIForRole(localStorage.getItem('roleId'));
    setupNavigation();
    handleRoute();
    setupGlobalEvents();
}

function updateUIForRole(roleId) {
    const rolePermissions = {
      1: { // admin
        hidden: [],
        disabled: [],
        sections: ['analytics', 'products', 'suppliers', 'sales', 'relationships']
      },
      2: { // staff
        hidden: ['.admin-only', '.manager-only'],
        disabled: ['.delete-control'],
        sections: ['products', 'sales']
      },
      3: { // manager
        hidden: ['.user-management'],
        disabled: ['.role-modification'],
        sections: ['analytics', 'products', 'suppliers', 'sales']
      },
      4: { // guest
        hidden: ['.edit-control', '.delete-control'],
        disabled: ['.modify-control'],
        sections: ['products']
      }
    };
  
    const currentRole = rolePermissions[roleId] || rolePermissions[5];
    
    currentRole.hidden.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
    });
    
    currentRole.disabled.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.disabled = true);
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
      const section = item.dataset.section;
      item.style.display = currentRole.sections.includes(section) ? 'block' : 'none';
    });
  }

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            
            const section = e.currentTarget.dataset.section;
            e.currentTarget.classList.add('active');

            currentSection = section;
            await loadSectionContent(section);
            window.location.hash = section;
        });
    });
}

function renderSectionContent(section, data) {
    const contentArea = document.getElementById('contentArea');
    
    switch(section) {
        case 'products':
            contentArea.innerHTML = renderProducts(data);
            setupProductEvents();
            break;
        case 'suppliers':
            contentArea.innerHTML = renderSuppliers(data);
            setupSupplierEvents();
            break;
        case 'sales':
            contentArea.innerHTML = renderSales(data);
            setupSalesEvents();
            break;
        case 'analytics':
            contentArea.innerHTML = renderAnalytics(data);
            initializeAnalyticsCharts(data);
            break;
        case 'relationships':
            break;
        default:
            contentArea.innerHTML = '<p>Select a section from the navigation</p>';
    }
}

function renderProducts(products) {
    const isAdmin = localStorage.getItem('roleId') === '1';
    return `
        <div class="section-container">
            ${isAdmin ? renderAddProductForm() : ''}
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Current Stock</th>
                            ${isAdmin ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(product => `
                            <tr>
                                <td>${product.ProductID}</td>
                                <td>${product.Name}</td>
                                <td>${product.Category}</td>
                                <td>₱${product.Price}</td>
                                <td class="stock-value" data-product-id="${product.ProductID}">
                                    ${product.currentStock}
                                </td>
                                ${isAdmin ? `
                                    <td class="actions">
                                        <button class="btn-edit" data-id="${product.ProductID}">✏️</button>
                                        <button class="btn-delete" data-id="${product.ProductID}">🗑️</button>
                                        <button class="btn-stock" data-id="${product.ProductID}">📦</button>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSuppliers(suppliers) {
    return `
        <div class="section-container">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Contact Info</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${suppliers.map(supplier => `
                            <tr>
                                <td>${supplier.SupplierID}</td>
                                <td>${supplier.Name}</td>
                                <td>${supplier.ContactInfo}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAnalytics(data) {
    return `
        <div class="analytics-dashboard">
            <div class="analytics-header">
                <h2>Analytics Dashboard</h2>
                <div class="summary-cards">
                    <div class="summary-card total-sales">
                        <div class="icon">💰</div>
                        <div class="content">
                            <h3>Total Sales</h3>
                            <p>₱${data?.totalRevenue || '0.00'}</p>
                        </div>
                    </div>
                    <div class="summary-card avg-order">
                        <div class="icon">📦</div>
                        <div class="content">
                            <h3>Avg. Order Value</h3>
                            <p>₱${data?.avgOrderValue || '0.00'}</p>
                        </div>
                    </div>
                    <div class="summary-card low-stock">
                        <div class="icon">⚠️</div>
                        <div class="content">
                            <h3>Low Stock Items</h3>
                            <p>${data?.lowStockCount || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="chart-grid">
                <div class="chart-card">
                    <h4>Sales Trends</h4>
                    <canvas id="salesTrendChart"></canvas>
                </div>
                
                <div class="chart-card">
                    <h4>Stock Levels</h4>
                    <canvas id="stockLevelChart"></canvas>
                </div>
                
                <div class="chart-card">
                    <h4>Supplier Contribution</h4>
                    <canvas id="supplierChart"></canvas>
                </div>
            </div>

            <div class="recent-activity">
                <h4>Recent Sales</h4>
                <div class="activity-list">
                    ${renderRecentSales(data.recentSales)}
                </div>
            </div>
        </div>
    `;
}

function renderRecentSales(sales) {
    return `
        <table class="activity-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${sales.map(sale => `
                    <tr>
                        <td>${new Date(sale.SaleDate).toLocaleDateString()}</td>
                        <td>${sale.ProductName}</td>
                        <td>${sale.QuantitySold}</td>
                        <td>₱${sale.TotalAmount}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAddProductForm() {
    return `
      <h4>Add New Product</h4>
      <div class="add-form">
        <form id="productForm">
          <input type="text" name="name" placeholder="Product Name" required>
          <input type="text" name="category" placeholder="Category">
          <input type="number" step="0.01" name="price" placeholder="Price" required>
          <select id="select-supplier" name="supplierId" required>
            <option value="">Select Supplier</option>
            ${window.suppliers?.map(s => `<option value="${s.SupplierID}">${s.Name}</option>`).join('')}
          </select>
          <input type="number" name="quantity" placeholder="Initial Stock" required>
          <button type="submit" class="btn-primary">Add Product</button>
        </form>
      </div>
    `;
  }

function setupProductEvents() {
    const form = document.getElementById('productForm');
    if (form) {
        form.addEventListener('submit', handleProductSubmit);
    }

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', handleEditProduct);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteProduct);
    });

    document.querySelectorAll('.btn-stock').forEach(btn => {
        btn.addEventListener('click', handleStockAdjustment);
    });
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productData = {
        name: formData.get('name'),
        category: formData.get('category'),
        price: parseFloat(formData.get('price')),
        supplierId: parseInt(formData.get('supplierId')),
        quantity: parseInt(formData.get('quantity')) 
    };

    if (!productData.supplierId || isNaN(productData.quantity)) {
        showError('Supplier and initial stock are required');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const conflictMessage = errorData.error?.toLowerCase().includes('exist') 
                ? errorData.error 
                : 'Product already exists';
            throw new Error(conflictMessage);
        }
        
        await loadSectionContent('products');
        showSuccess('Product added successfully');
    } catch (error) {
        showError(error.message);
    }
}

async function handleEditProduct(e) {
    const productId = e.target.dataset.id;
    try {
        const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
            throw new Error(`Invalid content type: ${contentType}`);
        }

        const product = await response.json();
        
        if (!product.ProductID || !product.Name) {
            throw new Error('Invalid product data structure');
        }

        showEditProductModal(product);

    } catch (error) {
        console.error('Edit Product Error:', {
            error: error.message,
            productId,
            time: new Date().toISOString()
        });
        showError(`Failed to edit product: ${error.message}`);
    }
}

function showEditProductModal(product) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h4>Edit Product</h4>
            <form id="editProductForm">
                <div class="form-group">
                    <label>Product Name</label>
                    <input type="text" name="name" value="${product.Name}" required>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <input type="text" name="category" value="${product.Category}">
                </div>
                <div class="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" name="price" value="${product.Price}" required>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: var(--bg-dark);
        padding: 2rem;
        border-radius: 0.75rem;
        width: 90%;
        max-width: 500px;
        position: relative;
    `;

    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#editProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            name: formData.get('name'),
            category: formData.get('category'),
            price: parseFloat(formData.get('price'))
        };

        try {
            const response = await fetch(`http://localhost:3000/api/products/${product.ProductID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) throw new Error('Failed to update product');
            
            modal.remove();
            await loadSectionContent('products');
            showSuccess('Product updated successfully');
        } catch (error) {
            showError(error.message);
        }
    });

    document.body.appendChild(modal);
}

async function handleDeleteProduct(e) {
    const productId = e.target.dataset.id;
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete product');
        
        await loadSectionContent('products');
        showSuccess('Product deleted successfully');
    } catch (error) {
        showError(error.message);
    }
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'notification error';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 3000);
}

function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'notification success';
    successElement.textContent = message;
    document.body.appendChild(successElement);
    setTimeout(() => successElement.remove(), 3000);
}

function renderProductsTable(products) {
    const html = `
        <div class="card">
            <h3>Product List</h3>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td>${product.Name}</td>
                            <td>${product.Category}</td>
                            <td>$${product.Price.toFixed(2)}</td>
                            <td>${product.currentStock}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    document.getElementById('contentArea').innerHTML = html;
}

async function loadSectionContent(section) {
    try {
        const controller = new AbortController();
        window.fetchController = controller;

        if (section === 'products') {
            window.suppliers = await fetch('http://localhost:3000/api/suppliers', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }).then(r => r.json());
        }

        if (section !== 'relationships') {
            const response = await fetch(`http://localhost:3000/api/${section}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                signal: controller.signal
            });

            if (response.status === 401) {
                logout();
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || `Failed to load ${section}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid server response');
            }

            const data = await response.json();
            
            if (section === 'analytics') {
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid analytics data structure');
                }
            }
            
            renderSectionContent(section, data);
        }

        if (section === 'relationships') {
            const [relationships, suppliers, products] = await Promise.all([
                fetch('http://localhost:3000/api/supplier-products', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }).then(r => r.json()),
                fetch('http://localhost:3000/api/suppliers', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }).then(r => r.json()),
                fetch('http://localhost:3000/api/products', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }).then(r => r.json())
            ]);
            
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = renderSupplierProductLinking(relationships, suppliers, products);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Request aborted');
            return;
        }
        console.error(`Error loading ${section}:`, error);
        showError(error.message);

        if (section === 'analytics') {
            [window.salesChart, window.stockChart, window.supplierChart].forEach(chart => {
                if (chart) chart.destroy();
            });
        }
    }
}

let analyticsChart = null;

function setupSupplierEvents() {
    const form = document.getElementById('supplierForm');
    if (form) {
        form.addEventListener('submit', handleSupplierSubmit);
    }

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', handleEditSupplier);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteSupplier);
    });
}

function renderAddSupplierForm() {
    return `
            <h4>Add New Supplier</h4>
        <div class="add-form">
            <form id="supplierForm">
                <input type="text" name="name" placeholder="Supplier Name" required>
                <input type="text" name="contact" placeholder="Contact Information" required>
                <button type="submit" class="btn-primary">Add Supplier</button>
            </form>
        </div>
    `;
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const supplierData = {
        name: formData.get('name'),
        contactInfo: formData.get('contact')
    };

    try {
        const response = await fetch('http://localhost:3000/api/suppliers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(supplierData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const conflictMessage = errorData.error?.toLowerCase().includes('exist') 
                ? errorData.error 
                : 'Supplier already exists';
            throw new Error(conflictMessage);
        }
        
        await loadSectionContent('suppliers');
        showSuccess('Supplier added successfully');
    } catch (error) {
        showError(error.message);
    }
}

async function handleEditSupplier(e) {
    const supplierId = e.target.dataset.id;
    try {
        const response = await fetch(`http://localhost:3000/api/suppliers/${supplierId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
            throw new Error(`Invalid content type: ${contentType}`);
        }
        
        const supplier = await response.json();

        if (!supplier.SupplierID || !supplier.Name) {
            throw new Error('Invalid supplier data structure');
        }

        showEditSupplierModal(supplier);
    } catch (error) {
        showError(error.message);
    }
}

function showEditSupplierModal(supplier) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h4>Edit Supplier</h4>
            <form id="editSupplierForm">
                <div class="form-group">
                    <label>Supplier Name</label>
                    <input type="text" name="name" value="${supplier.Name}" required>
                </div>
                <div class="form-group">
                    <label>Contact Info</label>
                    <input type="text" name="contact" value="${supplier.ContactInfo}">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: var(--bg-dark);
        padding: 2rem;
        border-radius: 0.75rem;
        width: 90%;
        max-width: 500px;
        position: relative;
    `;

    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#editSupplierForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            name: formData.get('name'),
            contactInfo: formData.get('contact')
        };

        try {
            const response = await fetch(`http://localhost:3000/api/suppliers/${supplier.SupplierID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) throw new Error('Failed to update supplier');
            
            modal.remove();
            await loadSectionContent('suppliers');
            showSuccess('Supplier updated successfully');
        } catch (error) {
            showError(error.message);
        }
    });

    document.body.appendChild(modal);
}

async function handleDeleteSupplier(e) {
    const supplierId = e.target.dataset.id;
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
        const response = await fetch(`http://localhost:3000/api/suppliers/${supplierId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete supplier');
        
        await loadSectionContent('suppliers');
        showSuccess('Supplier deleted successfully');
    } catch (error) {
        showError(error.message);
    }
}

function initializeAnalyticsCharts(data) {
  
    const chartData = Array.isArray(data?.chartData) ? data.chartData : [];
    
    const initSalesChart = () => {
      const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
      if (!ctx) return;
  
      window.salesChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.map(item => item?.Name || 'Unnamed Product'),
          datasets: [{
            label: 'Sales Revenue',
            data: chartData.map(item => item?.totalRevenue || 0),
            borderColor: '#4CAF50',
            tension: 0.3
          }]
        },
        options: {
          ...chartConfig,
          responsive: true,
          maintainAspectRatio: false
        }
      });
    };
  
    const initStockChart = () => {
      const ctx = document.getElementById('stockLevelChart')?.getContext('2d');
      if (!ctx) return;
  
      window.stockChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.map(item => item?.Name || 'Unnamed Product'),
          datasets: [{
            label: 'Current Stock',
            data: chartData.map(item => item?.currentStock || 0),
            backgroundColor: '#7289da'
          }]
        },
        options: chartConfig
      });
    };
  
    initSalesChart();
    initStockChart();
    
    const initSupplierChart = () => {
      const ctx = document.getElementById('supplierChart')?.getContext('2d');
      if (!ctx) return;
  
      fetch('http://localhost:3000/api/analytics/suppliers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      .then(response => response.json())
      .then(suppliers => {
        window.supplierChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: suppliers.map(item => item?.Name || 'Unknown Supplier'),
            datasets: [{
              label: 'Supplier Contribution',
              data: suppliers.map(item => item?.totalStock || 0),
              backgroundColor: ['#7289da', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#009688']
            }]
          },
          options: chartConfig
        });
      });
    };
  
    initSupplierChart();
}

function logout() {
    if (window.cleanupCharts) window.cleanupCharts();
    if (window.fetchController) {
        window.fetchController.abort();
    }
    
    history.replaceState(null, null, ' ');
    window.location.hash = '';
    
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('authContainer').style.display = 'flex';
}

function renderSuppliers(suppliers) {
    const isAdmin = localStorage.getItem('roleId') === '1';
    return `
        <div class="section-container">
            ${isAdmin ? renderAddSupplierForm() : ''}
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Contact Info</th>
                            ${isAdmin ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${suppliers.map(supplier => `
                            <tr>
                                <td>${supplier.SupplierID}</td>
                                <td>${supplier.Name}</td>
                                <td>${supplier.ContactInfo}</td>
                                ${isAdmin ? `
                                    <td class="actions">
                                        <button class="btn-edit" data-id="${supplier.SupplierID}">✏️</button>
                                        <button class="btn-delete" data-id="${supplier.SupplierID}">🗑️</button>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSales(salesData) {
    return `
      <div class="section-container">
      <h4>Add Sales</h4>
        <div class="sales-form">
          <form id="salesForm">
            <select name="supplierId" id="supplierSelect" required>
                <option value="">Select Supplier</option>
            </select>
            <select name="productId" id="productSelect" required>
              <option value="">Select Product</option>
            </select>
            <input type="number" name="quantity" min="1" placeholder="Quantity" required>
            <button type="submit" class="btn-primary">Record Sale</button>
          </form>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(sale => `
                <tr>
                  <td>${new Date(sale.SaleDate).toLocaleDateString()}</td>
                  <td>${sale.ProductName}</td>
                  <td>${sale.QuantitySold}</td>
                  <td>₱${sale.TotalAmount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  async function setupSalesEvents() {
    try {
        const [products, suppliers] = await Promise.all([
            fetch('http://localhost:3000/api/products', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }),
            fetch('http://localhost:3000/api/suppliers', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
        ].map(async p => {
            const response = await p;
            if (!response.ok) throw new Error('Failed to fetch data');
            return response.json();
        }));

        if (!products || !suppliers) {
            throw new Error('Failed to load selection data');
        }

        const productSelect = document.getElementById('productSelect');
        productSelect.innerHTML = products.map(p => 
            `<option value="${p.ProductID}">${p.Name}</option>`
        ).join('');

        const supplierSelect = document.getElementById('supplierSelect');
        supplierSelect.innerHTML = suppliers.map(s => 
            `<option value="${s.SupplierID}">${s.Name}</option>`
        ).join('');

    } catch (error) {
        console.error('Sales Setup Error:', error);
        showError('Failed to load selection: Check your permissions');
        if (error.message.includes('401')) {
            logout();
        }
    }

    const salesForm = document.getElementById('salesForm');
    if (salesForm) {
        salesForm.addEventListener('submit', handleSaleSubmit);
    }
}
  
async function handleSaleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const saleData = {
      productId: formData.get('productId'),
      supplierId: formData.get('supplierId'),
      quantitySold: parseInt(formData.get('quantity'))
    };
  
    try {
        const response = await fetch('http://localhost:3000/api/sales', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(saleData)
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record sale');
      }
  
      await loadSectionContent('sales');
      showSuccess('Sale recorded successfully');
    } catch (error) {
      showError(error.message);
    }
}

function setupGlobalEvents() {
    document.getElementById('logoutButton').addEventListener('click', logout);
    window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
    const roleId = localStorage.getItem('roleId');
    const section = window.location.hash.substring(1);
    const navItem = document.querySelector(`[data-section="${section}"]`);

    const rolePermissions = {
        1: ['analytics', 'products', 'suppliers', 'sales', 'relationships'],
        2: ['products', 'sales'],
        3: ['analytics', 'products', 'suppliers', 'sales'],
        4: ['products']
    };

    let defaultSection = 'analytics';
    switch(roleId) {
        case '1': defaultSection = 'analytics'; break;
        case '2': defaultSection = 'sales'; break;
        case '3': defaultSection = 'analytics'; break;
        case '4': defaultSection = 'products'; break;
    }

    const permittedSections = rolePermissions[roleId] || [];
    if (!permittedSections.includes(section) || !navItem) {
        window.location.hash = defaultSection;
        return;
    }

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    navItem.classList.add('active');
    loadSectionContent(section);
}

function renderSupplierProductLinking(relationships, suppliers, products) {
    return `
      <div class="section-container">        
        <div class="link-form card">
        <h4>Supplier-Product Relationships</h4>
          <div class="form-row">
            <select id="supplierSelect" class="form-control">
              ${suppliers.map(s => `<option value="${s.SupplierID}">${s.Name}</option>`)}
            </select>
            
            <select id="productSelect" class="form-control">
              ${products.map(p => `<option value="${p.ProductID}">${p.Name}</option>`)}
            </select>
            
            <button class="btn-primary" onclick="linkSupplierProduct()">Link</button>
          </div>
        </div>
  
        <div class="relationship-grid card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Product</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${relationships.map(r => `
                <tr>
                  <td>${r.SupplierName}</td>
                  <td>${r.ProductName}</td>
                  <td>
                    <button class="btn-delete" 
                      onclick="unlinkSupplierProduct(${r.SupplierID}, ${r.ProductID})">
                      Unlink
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
}
  
async function linkSupplierProduct() {
    const supplierId = document.getElementById('supplierSelect').value;
    const productId = document.getElementById('productSelect').value;
  
    try {
      const response = await fetch('http://localhost:3000/api/supplier-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ supplierId, productId })
      });
  
      if (!response.ok) throw new Error('Failed to create relationship');
      await loadSectionContent('relationships');
      showSuccess('Relationship created successfully');
    } catch (error) {
      showError(error.message);
    }
}
  
async function unlinkSupplierProduct(supplierId, productId) {
    if (!confirm('Are you sure you want to unlink this relationship?')) return;
    
    try {
      const response = await fetch(`http://localhost:3000/api/supplier-products/${supplierId}/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
  
      if (!response.ok) throw new Error('Failed to delete relationship');
      await loadSectionContent('relationships');
      showSuccess('Relationship removed successfully');
    } catch (error) {
      showError(error.message);
    }
}

async function handleStockAdjustment(e) {
    const productId = e.target.dataset.id;
    try {
      const suppliers = await fetch(`http://localhost:3000/api/products/${productId}/suppliers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(r => r.json());
  
      const stockData = await Promise.all(suppliers.map(async (supplier) => {
        const response = await fetch(`http://localhost:3000/api/stock/${productId}/${supplier.SupplierID}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.json();
      }));
  
      showStockModal(productId, suppliers, stockData);
    } catch (error) {
      showError(error.message);
    }
}

function showStockModal(productId, suppliers, stockData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
      <h4>Manage Stock</h4>
      <form id="stockForm">
        ${suppliers.map((supplier, index) => `
          <div class="form-group">
            <label>${supplier.Name}</label>
            <input type="number" 
                   name="stock_${supplier.SupplierID}" 
                   value="${stockData[index].quantity}" 
                   required>
          </div>
        `).join('')}
        <div class="modal-actions">
          <button type="button" class="btn-cancel">Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
    `;

    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: var(--bg-dark);
        padding: 2rem;
        border-radius: 0.75rem;
        width: 90%;
        max-width: 500px;
        position: relative;
    `;
    
    modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#stockForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = suppliers.map(supplier => ({
        supplierId: supplier.SupplierID,
        quantity: parseInt(e.target[`stock_${supplier.SupplierID}`].value)
      }));
  
      try {
        await Promise.all(updates.map(async ({ supplierId, quantity }) => {
          await fetch(`http://localhost:3000/api/stock/${productId}/${supplierId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ quantity })
          });
        }));
        
        modal.remove();
        await loadSectionContent('products');
        showSuccess('Stock updated successfully');
      } catch (error) {
        showError(error.message);
      }
    });
  
    document.body.appendChild(modal);
}