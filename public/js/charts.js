let stockChart;
let salesChart;
let supplierChart;
let updateIntervals = [];

const chartConfig = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
      labels: { color: '#ffffff' }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: '#ffffff' },
      grid: { color: 'rgba(255,255,255,0.1)' }
    },
    x: {
      ticks: { color: '#ffffff' },
      grid: { color: 'rgba(255,255,255,0.1)' }
    }
  }
};

function initializeCharts() {
  cleanupCharts();

  if (document.getElementById('stockLevelChart')) {
    initStockChart();
    startStockUpdates();
  }

  if (document.getElementById('salesTrendChart')) {
    initSalesTrendChart();
    startSalesUpdates();
  }

  if (document.getElementById('supplierChart')) {
    initSupplierChart();
    startSupplierUpdates();
  }
}

function cleanupCharts() {
  [stockChart, salesChart, supplierChart].forEach(chart => {
    if (chart) chart.destroy();
  });
  updateIntervals.forEach(clearInterval);
  updateIntervals = [];
}

function initStockChart() {
  const ctx = document.getElementById('stockLevelChart').getContext('2d');
  
  stockChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Current Stock',
        data: [],
        backgroundColor: 'rgba(114,137,218,0.7)',
        borderColor: 'rgba(114,137,218,1)',
        borderWidth: 1
      }]
    },
    options: {
      ...chartConfig,
      animation: { duration: 300 }
    }
  });

  updateStockData();
}

async function updateStockData() {
  try {
    const response = await fetch('http://localhost:3000/api/analytics/stock', {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch stock data');
    
    const data = await response.json();
    
    stockChart.data.labels = data.map(item => item.Name);
    stockChart.data.datasets[0].data = data.map(item => item.currentStock);
    stockChart.update();
  } catch (error) {
    console.error('Stock chart error:', error);
    if (error.message.includes('401')) logout();
  }
}

function initSalesTrendChart() {
  const ctx = document.getElementById('salesTrendChart').getContext('2d');
  
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Sales Trend',
        data: [],
        borderColor: '#4CAF50',
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      ...chartConfig,
      elements: { point: { radius: 3 } }
    }
  });

  updateSalesData();
}

async function updateSalesData() {
  try {
    const response = await fetch('http://localhost:3000/api/analytics/sales', {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch sales data');
    
    const data = await response.json();
    
    salesChart.data.labels = data.map(item => item.Name);
    salesChart.data.datasets[0].data = data.map(item => item.totalRevenue);
    salesChart.update();
  } catch (error) {
    console.error('Sales chart error:', error);
    if (error.message.includes('401')) logout();
  }
}

function initSupplierChart() {
  const ctx = document.getElementById('supplierChart').getContext('2d');
  
  supplierChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{
        label: 'Supplier Contribution',
        data: [],
        backgroundColor: [
          '#7289da', '#4CAF50', '#FF9800', 
          '#E91E63', '#9C27B0', '#009688'
        ],
        borderWidth: 1
      }]
    },
    options: {
      ...chartConfig,
      plugins: {
        tooltip: { enabled: true }
      }
    }
  });

  updateSupplierData();
}

async function updateSupplierData() {
  try {
    const response = await fetch('http://localhost:3000/api/analytics/suppliers', {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch supplier data');
    
    const data = await response.json();
    
    supplierChart.data.labels = data.map(item => item.Name);
    supplierChart.data.datasets[0].data = data.map(item => item.totalStock);
    supplierChart.update();
  } catch (error) {
    console.error('Supplier chart error:', error);
    if (error.message.includes('401')) logout();
  }
}

function startStockUpdates() {
  updateIntervals.push(setInterval(updateStockData, 30000));
}

function startSalesUpdates() {
  updateIntervals.push(setInterval(updateSalesData, 60000));
}

function startSupplierUpdates() {
  updateIntervals.push(setInterval(updateSupplierData, 120000));
}

window.addEventListener('resize', () => {
  [stockChart, salesChart, supplierChart].forEach(chart => {
    if (chart) chart.resize();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard') && localStorage.getItem('token')) {
    initializeCharts();
  }
});

window.cleanupCharts = cleanupCharts;