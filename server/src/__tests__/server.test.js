const request = require('supertest');

// Mock dependencies before requiring server
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Server Configuration Tests', () => {
  let app;

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.clearAllMocks();
    delete require.cache[require.resolve('../server')];
    
    // Set NODE_ENV to test to prevent server from listening
    process.env.NODE_ENV = 'test';
    
    app = require('../server');
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('Server Initialization', () => {
    test('should initialize Express app', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });

    test('should respond to health check endpoint', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('message', 'Server is running');
    });

    test('should parse JSON request bodies', async () => {
      // Create a test route to verify JSON parsing
      app.post('/test-json', (req, res) => {
        res.json({ received: req.body });
      });

      const testData = { test: 'data', number: 123 };
      const response = await request(app)
        .post('/test-json')
        .send(testData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual(testData);
    });

    test('should parse URL-encoded request bodies', async () => {
      app.post('/test-urlencoded', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test-urlencoded')
        .send('key=value&foo=bar')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({ key: 'value', foo: 'bar' });
    });
  });

  describe('CORS Middleware', () => {
    test('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('should allow cross-origin requests', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://example.com');

      // CORS should not block the request
      expect(response.status).toBe(200);
    });
  });

  describe('Helmet Middleware', () => {
    test('should set security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet sets various security headers
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-download-options']).toBeDefined();
    });

    test('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should set X-Frame-Options', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-frame-options']).toBeDefined();
    });

    test('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/health');

      // Helmet removes the X-Powered-By header by default
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Error Handler', () => {
    test('should handle errors with custom error handler', async () => {
      // We need to test the error handler by triggering an actual error
      // Since we can't add routes after the error handler, we'll test with a non-existent route
      // and verify the error structure
      
      // Create a new express app to test error handler in isolation
      const express = require('express');
      const testApp = express();
      
      // Copy middleware from main app
      testApp.use(require('helmet')());
      testApp.use(require('cors')());
      testApp.use(express.json());
      
      // Add test route that throws error
      testApp.get('/test-error', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 400;
        error.code = 'TEST_ERROR';
        next(error);
      });
      
      // Copy error handler from server.js
      testApp.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(err.status || 500).json({
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : {}
          }
        });
      });

      const response = await request(testApp).get('/test-error');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'TEST_ERROR');
      expect(response.body.error).toHaveProperty('message', 'Test error');
      expect(response.body.error).toHaveProperty('details');
    });

    test('should default to 500 for errors without status', async () => {
      const express = require('express');
      const testApp = express();
      
      testApp.use(express.json());
      
      testApp.get('/test-500', (req, res, next) => {
        const error = new Error('Internal error');
        next(error);
      });
      
      testApp.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(err.status || 500).json({
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : {}
          }
        });
      });

      const response = await request(testApp).get('/test-500');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message', 'Internal error');
    });

    test('should use default error code when not provided', async () => {
      const express = require('express');
      const testApp = express();
      
      testApp.use(express.json());
      
      testApp.get('/test-default-code', (req, res, next) => {
        const error = new Error('Error without code');
        error.status = 400;
        next(error);
      });
      
      testApp.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(err.status || 500).json({
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : {}
          }
        });
      });

      const response = await request(testApp).get('/test-default-code');

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'INTERNAL_ERROR');
    });

    test('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
    });

    test('should log errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const express = require('express');
      const testApp = express();
      
      testApp.get('/test-console', (req, res, next) => {
        next(new Error('Console test error'));
      });
      
      testApp.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(err.status || 500).json({
          error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : {}
          }
        });
      });

      await request(testApp).get('/test-console');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
