const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/recovery-cases
 * Returns recovery cases with nested payment and customer details.
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      const err = new Error(`Database error fetching recovery cases: ${error.message}`);
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
