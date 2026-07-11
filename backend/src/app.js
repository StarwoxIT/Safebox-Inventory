const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const quoteRoutes = require('./routes/quotes');
const productRoutes = require('./routes/products');
const stockMovementRoutes = require('./routes/stockMovements');
const categoryRoutes = require('./routes/categories');
const unitRoutes = require('./routes/units');
const returnRoutes = require('./routes/returns');
const batteryCollectionRoutes = require('./routes/batteryCollections');
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const companyRoutes = require('./routes/company');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/battery-collections', batteryCollectionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

module.exports = app;
