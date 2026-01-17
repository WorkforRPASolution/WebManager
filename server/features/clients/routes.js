const express = require('express');
const router = express.Router();
const Client = require('./model');

// GET /api/clients/processes - Get distinct process list
router.get('/processes', async (req, res) => {
  try {
    const processes = await Client.distinct('process');
    res.json(processes.sort());
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ error: 'Failed to fetch processes' });
  }
});

// GET /api/clients/models - Get distinct eqpModel list
// Optional: filter by process (supports comma-separated multiple processes)
router.get('/models', async (req, res) => {
  try {
    const { process } = req.query;

    let query = {};
    if (process) {
      const processes = process.split(',').map(p => p.trim()).filter(p => p);
      if (processes.length === 1) {
        query.process = processes[0];
      } else if (processes.length > 1) {
        query.process = { $in: processes };
      }
    }

    const models = await Client.distinct('eqpModel', query);
    res.json(models.sort());
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// GET /api/clients - Get clients list
router.get('/', async (req, res) => {
  try {
    const { process, model } = req.query;

    const query = {};
    if (process) query.process = process;
    if (model) query.eqpModel = model;

    const clients = await Client.find(query)
      .select('eqpId eqpModel process IpAddr onoffNunber osVer category line')
      .sort({ eqpId: 1 });

    // Transform to frontend format
    const result = clients.map(client => ({
      id: client.eqpId,
      eqpId: client.eqpId,
      eqpModel: client.eqpModel,
      process: client.process,
      ipAddress: client.IpAddr,
      status: client.onoffNunber === 1 ? 'online' : 'offline',
      osVersion: client.osVer,
      category: client.category,
      line: client.line,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// ============================================
// Master Data Management APIs
// ============================================

// Validation helper
const validateClientData = (data, existingIds = [], existingIps = [], isUpdate = false) => {
  const errors = {};

  // Required fields
  const requiredFields = [
    'line', 'lineDesc', 'process', 'eqpModel', 'eqpId', 'category',
    'IpAddr', 'emailcategory', 'osVer'
  ];

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`;
    }
  }

  // Required number fields (0 is valid)
  const requiredNumberFields = [
    'localpcNunber', 'onoffNunber', 'webmanagerUse', 'usereleasemsg', 'usetkincancel'
  ];

  for (const field of requiredNumberFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors[field] = `${field} is required`;
    } else if (![0, 1].includes(Number(data[field]))) {
      errors[field] = `${field} must be 0 or 1`;
    }
  }

  // IP address format
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (data.IpAddr && !ipRegex.test(data.IpAddr)) {
    errors.IpAddr = 'Invalid IP address format';
  }
  if (data.IpAddrL && data.IpAddrL.trim() && !ipRegex.test(data.IpAddrL)) {
    errors.IpAddrL = 'Invalid IP address format';
  }

  // Date format (optional fields)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (data.installdate && data.installdate.trim() && !dateRegex.test(data.installdate)) {
    errors.installdate = 'Date format must be yyyy-MM-dd';
  }
  if (data.scFirstExcute && data.scFirstExcute.trim() && !dateRegex.test(data.scFirstExcute)) {
    errors.scFirstExcute = 'Date format must be yyyy-MM-dd';
  }

  // Unique checks (for new records or if value changed)
  if (!isUpdate) {
    if (data.eqpId && existingIds.includes(data.eqpId)) {
      errors.eqpId = 'Equipment ID already exists';
    }
    if (data.IpAddr && existingIps.includes(data.IpAddr)) {
      errors.IpAddr = 'IP address already exists';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

// GET /api/clients/master - Get clients with full data for master management
// Supports multiple process/model values (comma-separated)
// Supports server-side pagination with page and pageSize parameters
router.get('/master', async (req, res) => {
  try {
    const { process, model, ipSearch, page, pageSize } = req.query;

    const query = {};

    // Handle multiple processes (comma-separated)
    if (process) {
      const processes = process.split(',').map(p => p.trim()).filter(p => p);
      if (processes.length === 1) {
        query.process = processes[0];
      } else if (processes.length > 1) {
        query.process = { $in: processes };
      }
    }

    // Handle multiple models (comma-separated)
    if (model) {
      const models = model.split(',').map(m => m.trim()).filter(m => m);
      if (models.length === 1) {
        query.eqpModel = models[0];
      } else if (models.length > 1) {
        query.eqpModel = { $in: models };
      }
    }

    // IP search (case-insensitive partial match)
    if (ipSearch) {
      query.IpAddr = { $regex: ipSearch, $options: 'i' };
    }

    // Server-side pagination
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(pageSize) || 25;
    const skip = (currentPage - 1) * limit;

    // Execute query with pagination and count in parallel
    const [clients, total] = await Promise.all([
      Client.find(query).sort({ eqpId: 1 }).skip(skip).limit(limit).lean(),
      Client.countDocuments(query)
    ]);

    res.json({
      data: clients,
      total,
      page: currentPage,
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching master data:', error);
    res.status(500).json({ error: 'Failed to fetch master data' });
  }
});

// POST /api/clients/master - Batch create clients
router.post('/master', async (req, res) => {
  try {
    const { clients } = req.body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: 'clients array is required' });
    }

    // Get existing IDs and IPs for unique validation
    const existingClients = await Client.find({}, 'eqpId IpAddr');
    const existingIds = existingClients.map(c => c.eqpId);
    const existingIps = existingClients.map(c => c.IpAddr);

    const results = [];
    const errors = [];

    // Track new IDs and IPs within this batch
    const batchIds = [];
    const batchIps = [];

    for (let i = 0; i < clients.length; i++) {
      const clientData = clients[i];

      // Check for duplicates within batch
      if (batchIds.includes(clientData.eqpId)) {
        errors.push({ rowIndex: i, field: 'eqpId', message: 'Duplicate Equipment ID in batch' });
        continue;
      }
      if (batchIps.includes(clientData.IpAddr)) {
        errors.push({ rowIndex: i, field: 'IpAddr', message: 'Duplicate IP address in batch' });
        continue;
      }

      const validationErrors = validateClientData(
        clientData,
        [...existingIds, ...batchIds],
        [...existingIps, ...batchIps]
      );

      if (validationErrors) {
        for (const [field, message] of Object.entries(validationErrors)) {
          errors.push({ rowIndex: i, field, message });
        }
      } else {
        batchIds.push(clientData.eqpId);
        batchIps.push(clientData.IpAddr);
        results.push(clientData);
      }
    }

    // Insert valid clients
    let created = 0;
    if (results.length > 0) {
      const inserted = await Client.insertMany(results);
      created = inserted.length;
    }

    res.status(errors.length > 0 && created === 0 ? 400 : 201).json({
      success: created > 0,
      created,
      errors
    });
  } catch (error) {
    console.error('Error creating clients:', error);
    res.status(500).json({ error: 'Failed to create clients' });
  }
});

// PUT /api/clients/master - Batch update clients
router.put('/master', async (req, res) => {
  try {
    const { clients } = req.body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: 'clients array is required' });
    }

    const errors = [];
    let updated = 0;

    for (let i = 0; i < clients.length; i++) {
      const clientData = clients[i];
      const { _id, ...updateData } = clientData;

      if (!_id) {
        errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' });
        continue;
      }

      // Get other clients for unique validation (excluding current one)
      const otherClients = await Client.find({ _id: { $ne: _id } }, 'eqpId IpAddr');
      const existingIds = otherClients.map(c => c.eqpId);
      const existingIps = otherClients.map(c => c.IpAddr);

      // Check unique constraints
      if (updateData.eqpId && existingIds.includes(updateData.eqpId)) {
        errors.push({ rowIndex: i, field: 'eqpId', message: 'Equipment ID already exists' });
        continue;
      }
      if (updateData.IpAddr && existingIps.includes(updateData.IpAddr)) {
        errors.push({ rowIndex: i, field: 'IpAddr', message: 'IP address already exists' });
        continue;
      }

      const validationErrors = validateClientData(updateData, [], [], true);

      if (validationErrors) {
        for (const [field, message] of Object.entries(validationErrors)) {
          errors.push({ rowIndex: i, field, message });
        }
      } else {
        const result = await Client.updateOne({ _id }, { $set: updateData });
        if (result.modifiedCount > 0) {
          updated++;
        }
      }
    }

    res.json({
      success: updated > 0 || errors.length === 0,
      updated,
      errors
    });
  } catch (error) {
    console.error('Error updating clients:', error);
    res.status(500).json({ error: 'Failed to update clients' });
  }
});

// DELETE /api/clients/master - Batch delete clients
router.delete('/master', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const result = await Client.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      deleted: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting clients:', error);
    res.status(500).json({ error: 'Failed to delete clients' });
  }
});

// GET /api/clients/:id - Get client detail
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ eqpId: id });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Transform to frontend format with additional mock data for resources
    const result = {
      id: client.eqpId,
      eqpId: client.eqpId,
      eqpModel: client.eqpModel,
      process: client.process,
      ipAddress: client.IpAddr,
      innerIp: client.IpAddrL,
      status: client.onoffNunber === 1 ? 'online' : 'offline',
      osVersion: client.osVer,
      category: client.category,
      line: client.line,
      lineDesc: client.lineDesc,
      installDate: client.installdate,
      localPc: client.localpcNunber === 1,
      webmanagerUse: client.webmanagerUse === 1,
      // Resource data (mock for now - will be from Akka server in Phase 3)
      resources: {
        cpu: Math.floor(Math.random() * 60) + 20,
        memory: Math.floor(Math.random() * 40) + 40,
        storage: Math.floor(Math.random() * 30) + 50,
        latency: Math.floor(Math.random() * 100) + 10,
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching client detail:', error);
    res.status(500).json({ error: 'Failed to fetch client detail' });
  }
});

// GET /api/clients/:id/logs - Get client logs (mock for now)
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Check if client exists
    const client = await Client.findOne({ eqpId: id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Generate mock logs (will be from Akka server in Phase 3)
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const messages = [
      'System health check completed',
      'Connection established',
      'Processing request',
      'Memory usage within normal limits',
      'CPU temperature normal',
      'Network latency check passed',
      'Disk I/O operation completed',
      'Service heartbeat received',
    ];

    const logs = [];
    const now = new Date();

    for (let i = 0; i < parseInt(limit); i++) {
      const timestamp = new Date(now - i * 30000);
      logs.push({
        id: `log-${i}`,
        timestamp: timestamp.toISOString(),
        level: levels[Math.floor(Math.random() * (i < 5 ? 2 : 4))],
        message: messages[Math.floor(Math.random() * messages.length)],
      });
    }

    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// POST /api/clients/:id/restart - Restart client (mock for now)
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ eqpId: id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Mock response (will connect to Akka server in Phase 3)
    res.json({
      success: true,
      message: `Restart command sent to ${id}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error restarting client:', error);
    res.status(500).json({ error: 'Failed to restart client' });
  }
});

// POST /api/clients/:id/stop - Stop client (mock for now)
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ eqpId: id });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Mock response (will connect to Akka server in Phase 3)
    res.json({
      success: true,
      message: `Stop command sent to ${id}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error stopping client:', error);
    res.status(500).json({ error: 'Failed to stop client' });
  }
});

module.exports = router;
