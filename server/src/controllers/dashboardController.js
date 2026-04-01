const db = require('../db/database');

/**
 * Dashboard Controller
 * Handles HTTP requests for dashboard endpoints
 * Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3
 */

/**
 * Get admin dashboard statistics
 * GET /api/dashboard/admin
 * Requirements: 12.1, 12.2, 12.3
 * @param {Express.Request} req - Request with req.user (ADMIN)
 * @param {Express.Response} res - Response
 */
async function getAdminStats(req, res) {
  try {
    // Req 12.1: Total users, files, downloads
    const [totalUsers, totalFiles, totalDownloads] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM users'),
      db.get('SELECT COUNT(*) as count FROM files'),
      db.get('SELECT COUNT(*) as count FROM downloads')
    ]);

    // Req 12.2: Most downloaded files
    const mostDownloadedFiles = await db.all(
      `SELECT f.id, f.filename, f.mime_type, f.size, COUNT(d.id) as download_count
       FROM files f
       LEFT JOIN downloads d ON f.id = d.file_id
       GROUP BY f.id
       ORDER BY download_count DESC
       LIMIT 10`
    );

    // Req 12.3: User distribution by plan
    const userDistributionByPlan = await db.all(
      `SELECT p.id as plan_id, p.name as plan_name, COUNT(u.id) as user_count
       FROM plans p
       LEFT JOIN users u ON u.plan_id = p.id
       GROUP BY p.id
       ORDER BY user_count DESC`
    );

    res.status(200).json({
      stats: {
        totalUsers: totalUsers.count,
        totalFiles: totalFiles.count,
        totalDownloads: totalDownloads.count
      },
      mostDownloadedFiles,
      userDistributionByPlan
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching admin statistics'
      }
    });
  }
}

/**
 * Get user dashboard data
 * GET /api/dashboard/user
 * Requirements: 13.1, 13.2, 13.3
 * @param {Express.Request} req - Request with req.user
 * @param {Express.Response} res - Response
 */
async function getUserDashboard(req, res) {
  try {
    const userId = req.user.userId;

    // Req 13.2: Current plan info
    const userWithPlan = await db.get(
      `SELECT u.id, u.name, u.email, u.role, u.plan_id,
              p.name as plan_name, p.price as plan_price, p.features as plan_features
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!userWithPlan) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Req 13.1, 13.4: Download history ordered by date descending, with filename and date/time
    const downloadHistory = await db.all(
      `SELECT d.id, d.downloaded_at, f.filename, f.mime_type, f.size
       FROM downloads d
       JOIN files f ON d.file_id = f.id
       WHERE d.user_id = ?
       ORDER BY d.downloaded_at DESC`,
      [userId]
    );

    // Req 13.3: Total downloads count
    const totalDownloads = downloadHistory.length;

    // Parse plan features if stored as JSON string
    let planFeatures = null;
    if (userWithPlan.plan_features) {
      try {
        planFeatures = JSON.parse(userWithPlan.plan_features);
      } catch {
        planFeatures = userWithPlan.plan_features;
      }
    }

    res.status(200).json({
      currentPlan: {
        id: userWithPlan.plan_id,
        name: userWithPlan.plan_name,
        price: userWithPlan.plan_price,
        features: planFeatures
      },
      downloadHistory,
      totalDownloads
    });
  } catch (error) {
    console.error('User dashboard error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching dashboard data'
      }
    });
  }
}

module.exports = {
  getAdminStats,
  getUserDashboard
};
