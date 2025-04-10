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
    const [products] = await pool.execute('SELECT * FROM Products');
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, checkRole(['Admin']), async (req, res) => {
	try {
	  const { name, category, price } = req.body;
	  
	  const [existing] = await pool.execute(
		'SELECT * FROM Products WHERE Name = ?',
		[name]
	  );
	  
	  if (existing.length > 0) {
		return res.status(409).json({ 
		  error: 'Conflict',
		  message: 'Product with this name already exists' 
		});
	  }
  
	  const [result] = await pool.execute(
		`INSERT INTO Products (Name, Category, Price)
		VALUES (?, ?, ?)`,
		[name, category, price]
	  );
	  
	  res.status(201).json({ productId: result.insertId });
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ 
		error: 'Server error',
		message: error.message 
	  });
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

    res.setHeader('Content-Type', 'application/json');
    res.json(products[0]);

  } catch (error) {
    console.error('Product Fetch Error:', error);
    res.status(500).json({
      error: 'Database Error',
      message: 'Failed to retrieve product'
    });
  }
});

app.put('/api/products/:id', authenticateToken, checkRole(['Admin']), async (req, res) => {
    try {
      const { name, category, price } = req.body;
      await pool.execute(
        `UPDATE Products 
        SET Name = ?, Category = ?, Price = ?
        WHERE ProductID = ?`,
        [name, category, price, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/products/:id', authenticateToken, checkRole(['Admin']), async (req, res) => {
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

app.post('/api/stock', authenticateToken, checkRole(['Admin']), async (req, res) => {
  try {
    const { productId, supplierId, quantity } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO Stock (ProductID, SupplierID, QuantityAdded)
      VALUES (?, ?, ?)`,
      [productId, supplierId, quantity]
    );
    
    res.status(201).json({ stockId: result.insertId });
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
			   s.QuantitySold, s.TotalAmount, s.SaleDate 
		FROM Sales s
		JOIN Products p ON s.ProductID = p.ProductID
		ORDER BY s.SaleDate DESC
	  `);
	  res.json(sales);
	} catch (error) {
	  console.error(error);
	  res.status(500).json({ error: 'Server error' });
	}
});

app.post('/api/sales', authenticateToken, checkRole(['Admin', 'Manager']), async (req, res) => {
	const connection = await pool.getConnection();
	try {
	  await connection.beginTransaction();
	  const { productId, quantitySold } = req.body;
  
	  const [stock] = await connection.execute(
		`SELECT SUM(QuantityAdded) AS totalStock 
		FROM Stock 
		WHERE ProductID = ?`,
		[productId]
	  );
	  
	  const [sales] = await connection.execute(
		`SELECT SUM(QuantitySold) AS totalSales 
		FROM Sales 
		WHERE ProductID = ?`,
		[productId]
	  );
	  
	  const available = (stock[0].totalStock || 0) - (sales[0].totalSales || 0);
	  if (available < quantitySold) {
		await connection.rollback();
		return res.status(400).json({ error: 'Insufficient stock' });
	  }
  
	  const [product] = await connection.execute(
		`SELECT Price FROM Products WHERE ProductID = ?`,
		[productId]
	  );
	  
	  const [result] = await connection.execute(
		`INSERT INTO Sales (ProductID, QuantitySold, TotalAmount, SaleDate)
		VALUES (?, ?, ?, NOW())`,
		[productId, quantitySold, quantitySold * product[0].Price]
	  );
  
	  await connection.commit();
	  res.status(201).json({ 
		saleId: result.insertId,
		message: 'Sale recorded successfully'
	  });
	} catch (error) {
	  await connection.rollback();
	  console.error(error);
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
		  (COALESCE(SUM(st.QuantityAdded), 0) - 
		   COALESCE(SUM(sa.QuantitySold), 0)) AS currentStock
		FROM Products p
		LEFT JOIN Stock st ON p.ProductID = st.ProductID
		LEFT JOIN Sales sa ON p.ProductID = sa.ProductID
		GROUP BY p.ProductID, p.Name
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
              (COALESCE(SUM(st.QuantityAdded), 0) - 
              COALESCE(SUM(sa.QuantitySold), 0)) AS currentStock
          FROM Products p
          LEFT JOIN Stock st ON p.ProductID = st.ProductID
          LEFT JOIN Sales sa ON p.ProductID = sa.ProductID
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

      const chartData = parsedSales.map(sale => {
          const stock = parsedStock.find(item => item.ProductID === sale.ProductID);
          return {
              Name: sale.Name,
              totalRevenue: sale.totalRevenue,
              currentStock: stock?.currentStock || 0
          };
      });

      const [recentSales] = await pool.execute(`
          SELECT s.*, p.Name AS ProductName 
          FROM Sales s
          JOIN Products p ON s.ProductID = p.ProductID
          ORDER BY SaleDate DESC
          LIMIT 5
      `);

      const totalRevenue = parsedSales.reduce((acc, curr) => acc + curr.totalRevenue, 0);
      const totalSold = parsedSales.reduce((acc, curr) => acc + curr.totalSold, 0);
      
      res.json({
          totalRevenue: totalRevenue.toFixed(2),
          avgOrderValue: totalSold > 0 ? (totalRevenue / totalSold).toFixed(2) : 0,
          lowStockCount: chartData.filter(item => item.currentStock < 10).length,
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));