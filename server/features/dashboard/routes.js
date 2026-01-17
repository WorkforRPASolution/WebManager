const express = require('express');
const router = express.Router();
const Client = require('../clients/model');

// GET /api/dashboard/summary - Get dashboard KPI summary
router.get('/summary', async (req, res) => {
  try {
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ onoffNunber: 1 });
    const inactiveClients = totalClients - activeClients;

    // Get clients by process for breakdown
    const processCounts = await Client.aggregate([
      { $group: { _id: '$process', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Mock data for uptime and network (will be from Akka server in Phase 3)
    const summary = {
      activeClients,
      totalClients,
      inactiveClients,
      activeRate: totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : 0,
      uptime: '99.9%',
      errors: Math.floor(Math.random() * 5),
      networkTraffic: `${(Math.random() * 100).toFixed(1)} MB/s`,
      processCounts: processCounts.map(p => ({
        process: p._id,
        count: p.count
      }))
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

module.exports = router;
