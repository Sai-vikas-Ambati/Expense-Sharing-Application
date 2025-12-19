import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './modules/auth/routes';
import groupRoutes from './modules/groups/routes';
import expenseRoutes from './modules/expenses/routes';
import settlementRoutes from './modules/settlements/routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', expenseRoutes); // /api/groups/:groupId/expenses
app.use('/api/groups', settlementRoutes); // /api/groups/:groupId/balances, /api/groups/:groupId/settlements

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 Health check: http://localhost:${config.port}/health`);
});

export default app;
