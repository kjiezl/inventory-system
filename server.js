require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    }
    console.log('Successfully connected to database');
    connection.release();
});

const corsOptions = {
  origin: 'http://localhost:5500',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static('public'));
app.options('/api/signup', cors(corsOptions));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

const checkRole = (allowedRoles) => async (req, res, next) => {
  try {
    const [roles] = await pool.execute(
      `SELECT r.RoleName 
      FROM Users u
      JOIN Roles r ON u.RoleID = r.RoleID
      WHERE u.UserID = ?`,
      [req.user.userId]
    );
    
    if (!allowedRoles.includes(roles[0]?.RoleName)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Authentication

app.post('/api/login', async (req, res) => {
	try {
	  const { username, password } = req.body;
  
	  const [users] = await pool.execute(
		'SELECT * FROM Users WHERE Username = ?',
		[username]
	  );
  
	  if (!users.length || !(await bcrypt.compare(password, users[0].Password))) {
		return res.status(401).json({ error: 'Invalid credentials' });
	  }
  
	  const user = users[0];
	  const token = jwt.sign(
		{ userId: user.UserID, roleId: user.RoleID },
		process.env.JWT_SECRET,
		{ expiresIn: '1h' }
	  );
  
	  res.json({ token, roleId: user.RoleID });
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: 'Server error' });
	}
});

app.post('/api/signup', async (req, res) => {
    try {
        const { username, password, roleId } = req.body;
        
        if (!username || !password || !roleId) {
          return res.status(400).json({ 
              success: false,
              error: "All fields are required" 
          });
      }

        const [roles] = await pool.execute(
          'SELECT * FROM Roles WHERE RoleID = ?',
          [roleId]
        );
        if (roles.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Invalid role selection"
            });
        }
        
        const [existing] = await pool.execute(
          'SELECT * FROM Users WHERE Username = ?',
          [username]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: "Username already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.execute(
            `INSERT INTO Users (Username, Password, RoleID)
            VALUES (?, ?, ?)`,
            [username, hashedPassword, roleId]
        );
        
        res.status(201).json({ userId: result.insertId });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
          success: false,
          error: "Internal server error",
          details: error.message
      });
    }
});

// Users

app.get('/api/users', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.UserID, u.Username, r.RoleName 
      FROM Users u
      JOIN Roles r ON u.RoleID = r.RoleID`
    );
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { username, password, roleId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute(
      `INSERT INTO Users (Username, Password, RoleID)
      VALUES (?, ?, ?)`,
      [username, hashedPassword, roleId]
    );
    
    res.status(201).json({ userId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Product

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.execute(`
      SELECT p.*, 
        COALESCE(SUM(st.QuantityAdded), 0) AS currentStock,
        u.Username AS CreatedByUsername
      FROM Products p
      LEFT JOIN Stock st ON p.ProductID = st.ProductID
      LEFT JOIN Users u ON p.CreatedBy = u.UserID
      GROUP BY p.ProductID
    `);

    // for (let product of products) {
    //   const [suppliers] = await pool.execute(`
    //     SELECT s.Name AS SupplierName, 
    //            COALESCE(SUM(st.QuantityAdded), 0) AS Quantity,
    //            MAX(st.Price) AS Price
    //     FROM Suppliers s
    //     JOIN SupplierProducts sp ON s.SupplierID = sp.SupplierID
    //     LEFT JOIN Stock st ON st.ProductID = ? AND st.SupplierID = s.SupplierID
    //     WHERE sp.ProductID = ?
    //     GROUP BY s.SupplierID
    //   `, [product.ProductID, product.ProductID]);
    
    //   product.Suppliers = suppliers;
    // }
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, checkRole(['Admin', 'Manager']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, category, suppliers } = req.body;

    if (!name || !Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const [[userRole]] = await connection.execute(
      `SELECT r.RoleName FROM Roles r JOIN Users u ON r.RoleID = u.RoleID WHERE u.UserID = ?`,
      [req.user.userId]
    );
    const roleName = userRole?.RoleName || 'Unknown';

    const [productResult] = await connection.execute(
      `INSERT INTO Products (Name, Category, CreatedBy, CreatorRole) VALUES (?, ?, ?, ?)`,
      [name, category, req.user.userId, roleName]
    );

    const productId = productResult.insertId;

    for (const { supplierId, quantity, price: supplierPrice } of suppliers) {
      await connection.execute(
        `INSERT INTO SupplierProducts (SupplierID, ProductID) VALUES (?, ?)`,
        [supplierId, productId]
      );
      await connection.execute(
        `INSERT INTO Stock (ProductID, SupplierID, QuantityAdded, Price) VALUES (?, ?, ?, ?)`,
        [productId, supplierId, quantity, supplierPrice]
      );
    }

    await connection.commit();
    res.status(201).json({ productId });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM Products WHERE ProductID = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Product not found' 
      });
    }

    const product = products[0];

    const [supplierData] = await pool.execute(
      `SELECT s.SupplierID, s.Name AS SupplierName, 
              COALESCE(SUM(st.QuantityAdded), 0) AS Quantity,
              MAX(st.Price) AS Price
       FROM Suppliers s
       JOIN SupplierProducts sp ON s.SupplierID = sp.SupplierID
       LEFT JOIN Stock st ON st.SupplierID = s.SupplierID AND st.ProductID = ?
       WHERE sp.ProductID = ?
       GROUP BY s.SupplierID`,
      [req.params.id, req.params.id]
    );

    res.setHeader('Content-Type', 'application/json');
    product.Suppliers = supplierData;
    res.json(products[0]);

  } catch (error) {
    console.error('Product Fetch Error:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Failed to retrieve product'
    });
  }
});

app.get('/api/products/:id/stock-detail', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.id;

    const [details] = await pool.execute(`
      SELECT 
        s.SupplierID,
        s.Name AS SupplierName,
        COALESCE(SUM(st.QuantityAdded), 0) AS Quantity,
        MAX(st.Price) AS Price
      FROM Suppliers s
      JOIN SupplierProducts sp ON s.SupplierID = sp.SupplierID
      LEFT JOIN Stock st ON st.ProductID = ? AND st.SupplierID = s.SupplierID
      WHERE sp.ProductID = ?
      GROUP BY s.SupplierID
    `, [productId, productId]);

    res.json(details);
  } catch (error) {
    console.error('Stock Detail Error:', error);
    res.status(500).json({ error: 'Server error while fetching stock detail' });
  }
});

app.put('/api/products/:id', authenticateToken, checkRole(['Admin', 'Manager']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const productId = req.params.id;
    const { name, category, suppliers } = req.body;

    await connection.execute(
      `UPDATE Products SET Name = ?, Category = ? WHERE ProductID = ?`,
      [name, category, productId]
    );

    if (Array.isArray(suppliers)) {
      for (const { supplierId, quantity, price: supplierPrice } of suppliers) {
        await connection.execute(`
          INSERT IGNORE INTO SupplierProducts (SupplierID, ProductID)
          VALUES (?, ?)
        `, [supplierId, productId]);

        await connection.execute(`
          DELETE FROM Stock WHERE ProductID = ? AND SupplierID = ?
        `, [productId, supplierId]);

        await connection.execute(`
          INSERT INTO Stock (ProductID, SupplierID, QuantityAdded, Price)
          VALUES (?, ?, ?, ?)
        `, [productId, supplierId, quantity, supplierPrice]);
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  } finally {
    connection.release();
  }
});

app.delete('/api/products/:id', authenticateToken, checkRole(['Admin', 'Manager']), async (req, res) => {
	const connection = await pool.getConnection();
	try {
	  await connection.beginTransaction();
  
	  await connection.execute(
		'DELETE FROM Sales WHERE ProductID = ?',
		[req.params.id]
	  );
	  
	  await connection.execute(
		'DELETE FROM Stock WHERE ProductID = ?',
		[req.params.id]
	  );
	  
	  await connection.execute(
		'DELETE FROM SupplierProducts WHERE ProductID = ?',
		[req.params.id]
	  );
  
	  await connection.execute(
		'DELETE FROM Products WHERE ProductID = ?',
		[req.params.id]
	  );
  
	  await connection.commit();
	  res.json({ success: true });
	} catch (error) {
	  await connection.rollback();
	  console.error(error);
	  res.status(500).json({ 
		error: 'Server error',
		message: error.message 
	  });
	} finally {
	  connection.release();
	}
});

app.get('/api/products/:id/suppliers', authenticateToken, async (req, res) => {
  try {
    const [suppliers] = await pool.execute(`
      SELECT s.SupplierID, s.Name 
      FROM Suppliers s
      JOIN SupplierProducts sp ON s.SupplierID = sp.SupplierID
      WHERE sp.ProductID = ?
    `, [req.params.id]);
    
    res.json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Supplier

app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const [suppliers] = await pool.execute('SELECT * FROM Suppliers');
    res.json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/suppliers', authenticateToken, checkRole(['Admin']), async (req, res) => {
	try {
	  const { name, contactInfo } = req.body;
	  
	  const [existing] = await pool.execute(
		'SELECT * FROM Suppliers WHERE Name = ?',
		[name]
	  );
	  
	  if (existing.length > 0) {
		return res.status(409).json({ 
		  error: 'Conflict',
		  message: 'Supplier with this name already exists' 
		});
	  }
  
	  const [result] = await pool.execute(
		`INSERT INTO Suppliers (Name, ContactInfo)
		VALUES (?, ?)`,
		[name, contactInfo]
	  );
	  
	  res.status(201).json({ supplierId: result.insertId });
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ 
		error: 'Server error',
		message: error.message 
	  });
	}
});

app.get('/api/suppliers/:id', authenticateToken, async (req, res) => {
	try {
	  const [suppliers] = await pool.execute(
		'SELECT * FROM Suppliers WHERE SupplierID = ?',
		[req.params.id]
	  );
  
	  if (suppliers.length === 0) {
		return res.status(404).json({ 
		  error: 'Not Found',
		  message: 'Supplier not found' 
		});
	  }
  
	  res.setHeader('Content-Type', 'application/json');
	  res.json(suppliers[0]);
  
	} catch (error) {
	  console.error('Supplier Fetch Error:', error);
	  res.status(500).json({
		error: 'Database Error',
		message: 'Failed to retrieve supplier'
	  });
	}
});

app.put('/api/suppliers/:id', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
      const { name, contactInfo } = req.body;
      await pool.execute(
        `UPDATE Suppliers 
        SET Name = ?, ContactInfo = ?
        WHERE SupplierID = ?`,
        [name, contactInfo, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/suppliers/:id', authenticateToken, checkRole(['Admin']), async (req, res) => {
	const connection = await pool.getConnection();
	try {
	  await connection.beginTransaction();
  
	  await connection.execute(
		'DELETE FROM Stock WHERE SupplierID = ?',
		[req.params.id]
	  );
	  
	  await connection.execute(
		'DELETE FROM SupplierProducts WHERE SupplierID = ?',
		[req.params.id]
	  );
  
	  await connection.execute(
		'DELETE FROM Suppliers WHERE SupplierID = ?',
		[req.params.id]
	  );
  
	  await connection.commit();
	  res.json({ success: true });
	} catch (error) {
	  await connection.rollback();
	  console.error(error);
	  res.status(500).json({ 
		error: 'Server error',
		message: error.message 
	  });
	} finally {
	  connection.release();
	}
});

// Stock

app.get('/api/stock/:productId/:supplierId', authenticateToken, async (req, res) => {
  try {
    const { productId, supplierId } = req.params;
    
    if (isNaN(productId) || isNaN(supplierId)) {
      return res.status(400).json({ error: 'Invalid product or supplier ID' });
    }

    const [stock] = await pool.execute(
      `SELECT COALESCE(SUM(QuantityAdded), 0) AS stock
       FROM Stock 
       WHERE ProductID = ? AND SupplierID = ?`,
      [productId, supplierId]
    );

    const availableStock = Number(stock[0].stock);
    res.json({ stock: availableStock });
    
  } catch (error) {
    console.error('Stock endpoint error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/stock/:productId/:supplierId', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { quantity } = req.body;
    
    await pool.execute(
      `DELETE FROM Stock 
       WHERE ProductID = ? AND SupplierID = ?`,
      [req.params.productId, req.params.supplierId]
    );

    await pool.execute(
      `INSERT INTO Stock (ProductID, SupplierID, QuantityAdded)
       VALUES (?, ?, ?)`,
      [req.params.productId, req.params.supplierId, quantity]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sales

app.get('/api/sales', async (req, res) => {
	try {
	  const [sales] = await pool.execute(`
      SELECT s.SaleID, s.ProductID, p.Name AS ProductName, 
       s.QuantitySold, s.TotalAmount, s.SaleDate,
       u.Username AS CreatedByUsername, s.CreatorRole
      FROM Sales s
      JOIN Products p ON s.ProductID = p.ProductID
      LEFT JOIN Users u ON s.CreatedBy = u.UserID
      ORDER BY s.SaleDate DESC
	  `);
	  res.json(sales);
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: 'Server error' });
	}
});

app.post('/api/sales', authenticateToken, checkRole(['Admin', 'Manager', 'Staff']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { productId, supplierId, quantitySold } = req.body;

    const [[stock]] = await connection.execute(
      `SELECT SUM(QuantityAdded) AS availableStock,
              MAX(Price) AS unitPrice
       FROM Stock 
       WHERE ProductID = ? AND SupplierID = ?`,
      [productId, supplierId]
    );

    if (stock.availableStock < quantitySold) {
      await connection.rollback();
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const totalAmount = quantitySold * stock.unitPrice;

    await connection.execute(
      `INSERT INTO Stock (ProductID, SupplierID, QuantityAdded)
       VALUES (?, ?, ?)`,
      [productId, supplierId, -quantitySold]
    );

    const [[userRole]] = await connection.execute(
      `SELECT r.RoleName FROM Roles r JOIN Users u ON r.RoleID = u.RoleID WHERE u.UserID = ?`,
      [req.user.userId]
    );
    const roleName = userRole?.RoleName || 'Unknown';

    await connection.execute(
      `INSERT INTO Sales (ProductID, QuantitySold, TotalAmount, SaleDate, CreatedBy, CreatorRole)
      VALUES (?, ?, ?, NOW(), ?, ?)`,
      [productId, quantitySold, totalAmount, req.user.userId, roleName]
    );

    await connection.commit();
    res.status(201).json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error('Sales Error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
});

// Analytics

app.get('/api/analytics/stock', authenticateToken, async (req, res) => {
  try {
    const [data] = await pool.execute(`
      SELECT 
        p.ProductID,
        p.Name,
        COALESCE(SUM(st.QuantityAdded), 0) AS currentStock
      FROM Products p
      LEFT JOIN Stock st ON p.ProductID = st.ProductID
      GROUP BY p.ProductID
    `);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/analytics/sales', authenticateToken, async (req, res) => {
  try {
    const [results] = await pool.execute(
      `SELECT p.Name, SUM(s.QuantitySold) AS totalSold, SUM(s.TotalAmount) AS totalRevenue
      FROM Sales s
      JOIN Products p ON s.ProductID = p.ProductID
      GROUP BY p.ProductID`
    );
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/analytics/suppliers', authenticateToken, async (req, res) => {
    try {
        const [results] = await pool.execute(`
            SELECT s.Name, SUM(st.QuantityAdded) AS totalStock
            FROM Suppliers s
            LEFT JOIN Stock st ON s.SupplierID = st.SupplierID
            GROUP BY s.SupplierID
        `);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/validate-token', authenticateToken, (req, res) => {
    res.json({ 
        userId: req.user.userId,
        roleId: req.user.roleId
    });
});

app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const [salesData] = await pool.execute(`
      SELECT 
          p.ProductID,
          p.Name,
          SUM(s.QuantitySold) AS totalSold,
          SUM(s.TotalAmount) AS totalRevenue
      FROM Sales s
      JOIN Products p ON s.ProductID = p.ProductID
      GROUP BY p.ProductID
    `);

    const [stockData] = await pool.execute(`
      SELECT 
          p.ProductID,
          p.Name,
          COALESCE(SUM(st.QuantityAdded), 0) AS currentStock
      FROM Products p
      LEFT JOIN Stock st ON st.ProductID = p.ProductID
      GROUP BY p.ProductID
    `);

    const parsedSales = salesData.map(item => ({
      ...item,
      totalSold: Number(item.totalSold),
      totalRevenue: Number(item.totalRevenue)
    }));

    const parsedStock = stockData.map(item => ({
      ...item,
      currentStock: Number(item.currentStock)
    }));

    const chartData = parsedStock.map(stock => {
      const sale = parsedSales.find(s => s.ProductID === stock.ProductID);
      return {
        Name: stock.Name,
        currentStock: stock.currentStock,
        totalRevenue: sale?.totalRevenue || 0
      };
    });

    const [recentSales] = await pool.execute(`
      SELECT s.*, p.Name AS ProductName 
      FROM Sales s
      JOIN Products p ON s.ProductID = p.ProductID
      ORDER BY SaleDate DESC
      LIMIT 5
    `);

    const totalRevenue = parsedSales.reduce((acc, cur) => acc + cur.totalRevenue, 0);
    const totalSold = parsedSales.reduce((acc, cur) => acc + cur.totalSold, 0);

    const lowStockCount = chartData.filter(item => item.currentStock < 10).length;

    res.json({
      totalRevenue: totalRevenue.toFixed(2),
      avgOrderValue: totalSold > 0 ? (totalRevenue / totalSold).toFixed(2) : 0,
      lowStockCount,
      recentSales,
      chartData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/supplier-products', authenticateToken, async (req, res) => {
  try {
    const [relationships] = await pool.execute(`
      SELECT sp.*, s.Name AS SupplierName, p.Name AS ProductName 
      FROM SupplierProducts sp
      JOIN Suppliers s ON sp.SupplierID = s.SupplierID
      JOIN Products p ON sp.ProductID = p.ProductID
    `);
    res.json(relationships);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/supplier-products', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { supplierId, productId } = req.body;
    
    const [supplier] = await pool.execute('SELECT * FROM Suppliers WHERE SupplierID = ?', [supplierId]);
    const [product] = await pool.execute('SELECT * FROM Products WHERE ProductID = ?', [productId]);
    
    if (!supplier.length || !product.length) {
      return res.status(404).json({ error: 'Supplier or product not found' });
    }

    const [result] = await pool.execute(
      'INSERT INTO SupplierProducts (SupplierID, ProductID) VALUES (?, ?)',
      [supplierId, productId]
    );
    
    res.status(201).json({ relationshipId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/supplier-products/:supplierId/:productId', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM SupplierProducts WHERE SupplierID = ? AND ProductID = ?',
      [req.params.supplierId, req.params.productId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/suppliers/:id/products', authenticateToken, async (req, res) => {
  try {
    const [products] = await pool.execute(`
      SELECT p.* 
      FROM Products p
      JOIN SupplierProducts sp ON p.ProductID = sp.ProductID
      WHERE sp.SupplierID = ?
    `, [req.params.id]);
    
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));