# Inventory Management System

A full-stack, role-based Inventory Management System built with **Node.js**, **Express**, and **MySQL**, featuring:

- User authentication (JWT)
- Role-based access (Admin, Manager, Staff, Guest)
- Product and stock tracking
- Sales recording with stock deduction
- Real-time analytics dashboard
- Clean and interactive dashboard UI (Vanilla JS + CSS)

---

## Features

### Authentication
- Secure login/signup using JWT tokens
- Session stored in browser localStorage

### Role-Based Access
- Admin
- Manager
- Staff
- Guest

### Products & Stock
- Add products with multiple suppliers
- Each supplier has distinct stock and pricing
- Display stock and price per supplier per product

### Sales
- Deducts from actual supplier stock
- Records sale with user and role who made it

### Analytics Dashboard
- Total revenue, average order value, low-stock alerts
- Sales trends, stock levels, and supplier contributions via charts
