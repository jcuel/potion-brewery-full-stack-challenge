import './suppressExperimentalWarnings';
import express, { Request, Response, NextFunction } from 'express';
import { graphql } from 'graphql';
import { initializeDatabase } from './database/init';
import alchemistRoutes from './api/alchemists';
import { schema, root } from './api/potions';

const PORT = process.env.PORT || 4000;

function startServer() {
  const app = express();

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  initializeDatabase();
  console.log('🧪 Database is ready');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: '🧙 The brewery is bubbling!' });
  });

  app.use('/api', alchemistRoutes);
  console.log('⚗️  REST API routes mounted at /api');

  app.post('/graphql', async (req, res) => {
    const { query, variables, operationName } = req.body ?? {};

    if (typeof query !== 'string') {
      res.status(400).json({ errors: [{ message: 'A GraphQL query string is required.' }] });
      return;
    }

    const result = await graphql({
      schema,
      source: query,
      rootValue: root,
      variableValues: variables,
      operationName,
    });

    res.json(result);
  });
  console.log('🔮 GraphQL endpoint mounted at /graphql');

  app.listen(PORT, () => {
    console.log('');
    console.log('🧪✨ Potion Brewery Backend is running! ✨🧪');
    console.log(`⚗️  REST API:  http://localhost:${PORT}/api`);
    console.log(`🔮 GraphQL:   http://localhost:${PORT}/graphql`);
    console.log(`💚 Health:    http://localhost:${PORT}/health`);
    console.log('');
  });
}

try {
  startServer();
} catch (err) {
  console.error('💥 Failed to start the Potion Brewery:', err);
  process.exit(1);
}
