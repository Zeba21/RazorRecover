const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/payments
 * Returns payment records needed by the dashboard/demo,
 * joining customer name and email.
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*, customers(name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      const err = new Error(`Database error fetching payments: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
