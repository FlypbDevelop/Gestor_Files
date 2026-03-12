// Manual mock for database module
const database = {
  getDatabase: jest.fn(),
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
};

module.exports = database;
