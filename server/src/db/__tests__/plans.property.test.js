const fc = require('fast-check');
const db = require('../database');

describe('Plans - Property-Based Tests', () => {
  beforeEach(async () => {
    // Clean up plans table before each test
    await db.run('DELETE FROM plans WHERE name NOT IN (?, ?, ?)', ['Free', 'Basic', 'Premium']);
  });

  afterAll(async () => {
    // Clean up test data
    await db.run('DELETE FROM plans WHERE name NOT IN (?, ?, ?)', ['Free', 'Basic', 'Premium']);
    await db.closeDatabase();
  }, 10000);

  /**
   * Property 28: Plans can be created with all required fields
   * **Validates: Requirements 10.1**
   */
  describe('Property 28: Plans can be created with all required fields', () => {
    it('should successfully create plans with any valid name, price, and features JSON', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.record({
            maxDownloadsPerMonth: fc.integer({ min: -1, max: 10000 }),
            maxFileSize: fc.integer({ min: 1, max: 1000 }),
            prioritySupport: fc.boolean(),
            customFeatures: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 })
          }),
          async (name, price, features) => {
            // Arrange: Create features JSON string
            const featuresJson = JSON.stringify(features);

            // Act: Insert plan
            const result = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price, featuresJson]
            );

            // Assert: Plan was created successfully
            expect(result.lastID).toBeGreaterThan(0);

            // Verify plan exists in database
            const plan = await db.get(
              'SELECT * FROM plans WHERE id = ?',
              [result.lastID]
            );

            expect(plan).toBeDefined();
            expect(plan.name).toBe(name);
            expect(parseFloat(plan.price)).toBeCloseTo(price, 2);
            expect(plan.features).toBe(featuresJson);

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result.lastID]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for property-based test

    it('should create plans with all required fields present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.string({ minLength: 2, maxLength: 500 }).filter(s => {
            try {
              JSON.parse(s);
              return true;
            } catch {
              return false;
            }
          }),
          async (name, price, featuresJson) => {
            // Act: Insert plan
            const result = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price, featuresJson]
            );

            // Assert: Plan has all required fields
            const plan = await db.get(
              'SELECT * FROM plans WHERE id = ?',
              [result.lastID]
            );

            expect(plan).toHaveProperty('id');
            expect(plan).toHaveProperty('name');
            expect(plan).toHaveProperty('price');
            expect(plan).toHaveProperty('features');
            expect(plan).toHaveProperty('created_at');
            expect(plan).toHaveProperty('updated_at');

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result.lastID]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for property-based test
  });

  /**
   * Property 29: Duplicate plan names are rejected
   * **Validates: Requirements 10.2**
   */
  describe('Property 29: Duplicate plan names are rejected', () => {
    it('should reject any plan name that already exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.record({
            maxDownloadsPerMonth: fc.integer({ min: -1, max: 10000 }),
            maxFileSize: fc.integer({ min: 1, max: 1000 }),
            prioritySupport: fc.boolean(),
            customFeatures: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 })
          }),
          async (name, price, features) => {
            // Arrange: Create first plan
            const featuresJson = JSON.stringify(features);
            const result1 = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price, featuresJson]
            );

            // Act & Assert: Try to create duplicate plan
            await expect(
              db.run(
                'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
                [name, price + 10, featuresJson]
              )
            ).rejects.toThrow();

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result1.lastID]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for property-based test

    it('should reject duplicate names even with different prices and features', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.string({ minLength: 2, maxLength: 200 }).filter(s => {
            try {
              JSON.parse(s);
              return true;
            } catch {
              return false;
            }
          }),
          fc.string({ minLength: 2, maxLength: 200 }).filter(s => {
            try {
              JSON.parse(s);
              return true;
            } catch {
              return false;
            }
          }),
          async (name, price1, price2, features1, features2) => {
            // Arrange: Create first plan
            const result1 = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price1, features1]
            );

            // Act & Assert: Try to create plan with same name but different data
            await expect(
              db.run(
                'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
                [name, price2, features2]
              )
            ).rejects.toThrow();

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result1.lastID]);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for property-based test

    it('should reject duplicate names for default plans', async () => {
      const defaultPlans = ['Free', 'Basic', 'Premium'];

      for (const planName of defaultPlans) {
        await expect(
          db.run(
            'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
            [planName, 99.99, '{"test": true}']
          )
        ).rejects.toThrow();
      }
    });
  });

  /**
   * Property 30: Plan features round-trip correctly
   * **Validates: Requirements 10.3, 16.1, 16.2, 16.4**
   */
  describe('Property 30: Plan features round-trip correctly', () => {
    it('should preserve features object through parse → serialize → parse cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.record({
            maxDownloadsPerMonth: fc.integer({ min: -1, max: 10000 }),
            maxFileSize: fc.integer({ min: 1, max: 1000 }),
            prioritySupport: fc.boolean(),
            customFeatures: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 })
          }),
          async (name, price, features) => {
            // Arrange: Serialize features to JSON
            const featuresJson = JSON.stringify(features);

            // Act: Store in database
            const result = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price, featuresJson]
            );

            // Retrieve from database
            const plan = await db.get(
              'SELECT * FROM plans WHERE id = ?',
              [result.lastID]
            );

            // Parse features back
            const retrievedFeatures = JSON.parse(plan.features);

            // Assert: Round-trip produces equivalent object
            expect(retrievedFeatures).toEqual(features);

            // Verify each field individually
            expect(retrievedFeatures.maxDownloadsPerMonth).toBe(features.maxDownloadsPerMonth);
            expect(retrievedFeatures.maxFileSize).toBe(features.maxFileSize);
            expect(retrievedFeatures.prioritySupport).toBe(features.prioritySupport);
            expect(retrievedFeatures.customFeatures).toEqual(features.customFeatures);

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result.lastID]);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for property-based test

    it('should handle complex nested features structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(name => !['Free', 'Basic', 'Premium'].includes(name)),
          fc.double({ min: 0, max: 999.99, noNaN: true }),
          fc.record({
            maxDownloadsPerMonth: fc.integer({ min: -1, max: 10000 }),
            maxFileSize: fc.integer({ min: 1, max: 1000 }),
            prioritySupport: fc.boolean(),
            customFeatures: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 30 }),
                enabled: fc.boolean(),
                value: fc.oneof(fc.integer(), fc.string({ maxLength: 20 }), fc.boolean())
              }),
              { maxLength: 3 }
            ),
            metadata: fc.record({
              description: fc.string({ maxLength: 100 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 })
            })
          }),
          async (name, price, features) => {
            // Arrange: Serialize features to JSON
            const featuresJson = JSON.stringify(features);

            // Act: Store and retrieve
            const result = await db.run(
              'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
              [name, price, featuresJson]
            );

            const plan = await db.get(
              'SELECT * FROM plans WHERE id = ?',
              [result.lastID]
            );

            const retrievedFeatures = JSON.parse(plan.features);

            // Assert: Complex structure is preserved
            expect(retrievedFeatures).toEqual(features);

            // Cleanup
            await db.run('DELETE FROM plans WHERE id = ?', [result.lastID]);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for property-based test

    it('should handle edge cases in features JSON', async () => {
      const edgeCaseFeatures = [
        { maxDownloadsPerMonth: 0, maxFileSize: 1, prioritySupport: false, customFeatures: [] },
        { maxDownloadsPerMonth: -1, maxFileSize: 999999, prioritySupport: true, customFeatures: ['a', 'b', 'c'] },
        { maxDownloadsPerMonth: 1, maxFileSize: 1, prioritySupport: false, customFeatures: [''] },
        { maxDownloadsPerMonth: 10000, maxFileSize: 1, prioritySupport: true, customFeatures: [] }
      ];

      for (let i = 0; i < edgeCaseFeatures.length; i++) {
        const features = edgeCaseFeatures[i];
        const name = `EdgeCase${i}_${Date.now()}`;
        const featuresJson = JSON.stringify(features);

        // Store in database
        const result = await db.run(
          'INSERT INTO plans (name, price, features) VALUES (?, ?, ?)',
          [name, 9.99, featuresJson]
        );

        // Retrieve and parse
        const plan = await db.get(
          'SELECT * FROM plans WHERE id = ?',
          [result.lastID]
        );

        const retrievedFeatures = JSON.parse(plan.features);

        // Assert: Edge case is preserved
        expect(retrievedFeatures).toEqual(features);

        // Cleanup
        await db.run('DELETE FROM plans WHERE id = ?', [result.lastID]);
      }
    });
  });
});
