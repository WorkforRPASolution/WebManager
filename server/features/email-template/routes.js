const express = require('express');
const router = express.Router();
const EmailTemplate = require('./model');

// Validation helper
const validateEmailTemplateData = (data, isUpdate = false) => {
  const errors = {};

  const requiredFields = ['app', 'process', 'model', 'code', 'subcode', 'title', 'htmp'];

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors[field] = `${field} is required`;
    }
  }

  // Max length checks
  if (data.app && data.app.length > 50) {
    errors.app = 'App name must be 50 characters or less';
  }
  if (data.title && data.title.length > 200) {
    errors.title = 'Title must be 200 characters or less';
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

// GET /api/email-template/processes - Get distinct process list
router.get('/processes', async (req, res) => {
  try {
    const processes = await EmailTemplate.distinct('process');
    res.json(processes.sort());
  } catch (error) {
    console.error('Error fetching processes:', error);
    res.status(500).json({ error: 'Failed to fetch processes' });
  }
});

// GET /api/email-template/models - Get distinct model list
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

    const models = await EmailTemplate.distinct('model', query);
    res.json(models.sort());
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// GET /api/email-template/codes - Get distinct code list
router.get('/codes', async (req, res) => {
  try {
    const { process, model } = req.query;

    let query = {};
    if (process) {
      const processes = process.split(',').map(p => p.trim()).filter(p => p);
      if (processes.length === 1) {
        query.process = processes[0];
      } else if (processes.length > 1) {
        query.process = { $in: processes };
      }
    }
    if (model) {
      const models = model.split(',').map(m => m.trim()).filter(m => m);
      if (models.length === 1) {
        query.model = models[0];
      } else if (models.length > 1) {
        query.model = { $in: models };
      }
    }

    const codes = await EmailTemplate.distinct('code', query);
    res.json(codes.sort());
  } catch (error) {
    console.error('Error fetching codes:', error);
    res.status(500).json({ error: 'Failed to fetch codes' });
  }
});

// GET /api/email-template - Get email templates with pagination
router.get('/', async (req, res) => {
  try {
    const { process, model, code, page, pageSize } = req.query;

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
        query.model = models[0];
      } else if (models.length > 1) {
        query.model = { $in: models };
      }
    }

    // Handle multiple codes (comma-separated)
    if (code) {
      const codes = code.split(',').map(c => c.trim()).filter(c => c);
      if (codes.length === 1) {
        query.code = codes[0];
      } else if (codes.length > 1) {
        query.code = { $in: codes };
      }
    }

    // Server-side pagination
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(pageSize) || 25;
    const skip = (currentPage - 1) * limit;

    // Execute query with pagination and count in parallel
    const [templates, total] = await Promise.all([
      EmailTemplate.find(query)
        .sort({ process: 1, model: 1, code: 1, subcode: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailTemplate.countDocuments(query)
    ]);

    res.json({
      data: templates,
      total,
      page: currentPage,
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// POST /api/email-template - Batch create email templates
router.post('/', async (req, res) => {
  try {
    const { templates } = req.body;

    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: 'templates array is required' });
    }

    const results = [];
    const errors = [];

    // Track composite keys in this batch for duplicate detection
    const batchKeys = new Set();

    for (let i = 0; i < templates.length; i++) {
      const templateData = templates[i];

      // Create composite key
      const compositeKey = `${templateData.app}|${templateData.process}|${templateData.model}|${templateData.code}|${templateData.subcode}`;

      // Check for duplicates within batch
      if (batchKeys.has(compositeKey)) {
        errors.push({ rowIndex: i, field: 'subcode', message: 'Duplicate template key in batch' });
        continue;
      }

      const validationErrors = validateEmailTemplateData(templateData);

      if (validationErrors) {
        for (const [field, message] of Object.entries(validationErrors)) {
          errors.push({ rowIndex: i, field, message });
        }
      } else {
        batchKeys.add(compositeKey);
        results.push(templateData);
      }
    }

    // Insert valid templates
    let created = 0;
    if (results.length > 0) {
      try {
        const inserted = await EmailTemplate.insertMany(results, { ordered: false });
        created = inserted.length;
      } catch (insertError) {
        if (insertError.code === 11000) {
          // Duplicate key error
          errors.push({ rowIndex: -1, field: 'key', message: 'One or more templates already exist with the same key' });
        } else {
          throw insertError;
        }
      }
    }

    res.status(errors.length > 0 && created === 0 ? 400 : 201).json({
      success: created > 0,
      created,
      errors
    });
  } catch (error) {
    console.error('Error creating email templates:', error);
    res.status(500).json({ error: 'Failed to create email templates' });
  }
});

// PUT /api/email-template - Batch update email templates
router.put('/', async (req, res) => {
  try {
    const { templates } = req.body;

    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: 'templates array is required' });
    }

    const errors = [];
    let updated = 0;

    for (let i = 0; i < templates.length; i++) {
      const templateData = templates[i];
      const { _id, ...updateData } = templateData;

      if (!_id) {
        errors.push({ rowIndex: i, field: '_id', message: '_id is required for update' });
        continue;
      }

      const validationErrors = validateEmailTemplateData(updateData, true);

      if (validationErrors) {
        for (const [field, message] of Object.entries(validationErrors)) {
          errors.push({ rowIndex: i, field, message });
        }
      } else {
        try {
          const result = await EmailTemplate.updateOne({ _id }, { $set: updateData });
          if (result.modifiedCount > 0) {
            updated++;
          }
        } catch (updateError) {
          if (updateError.code === 11000) {
            errors.push({ rowIndex: i, field: 'key', message: 'Duplicate template key' });
          } else {
            throw updateError;
          }
        }
      }
    }

    res.json({
      success: updated > 0 || errors.length === 0,
      updated,
      errors
    });
  } catch (error) {
    console.error('Error updating email templates:', error);
    res.status(500).json({ error: 'Failed to update email templates' });
  }
});

// DELETE /api/email-template - Batch delete email templates
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const result = await EmailTemplate.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      deleted: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting email templates:', error);
    res.status(500).json({ error: 'Failed to delete email templates' });
  }
});

module.exports = router;
