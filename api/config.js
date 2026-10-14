'use strict';

const { getSupabaseConfig } = require('../supabase-config');

module.exports = (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.setHeader('Cache-Control', 'no-store');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.status(200).json(getSupabaseConfig());
};
