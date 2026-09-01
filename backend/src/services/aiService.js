const { config } = require('../config/env');

/**
 * Service helper to communicate with the Python FastAPI AI Service.
 */
async function predictRecovery(payload) {
  const url = `${config.aiServiceUrl}/predict-recovery`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { detail: response.statusText };
      }
      const err = new Error(
        typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail || errorData)
      );
      err.statusCode = response.status;
      err.data = errorData;
      throw err;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 502;
      error.message = `Failed to connect to AI service at ${url}: ${error.message}`;
    }
    throw error;
  }
}

/**
 * Service helper to get SHAP recovery explanation from FastAPI AI Service.
 */
async function explainRecovery(payload) {
  const url = `${config.aiServiceUrl}/explain-recovery`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { detail: response.statusText };
      }
      const err = new Error(
        typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail || errorData)
      );
      err.statusCode = response.status;
      err.data = errorData;
      throw err;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 502;
      error.message = `Failed to connect to AI service at ${url}: ${error.message}`;
    }
    throw error;
  }
}

module.exports = {
  predictRecovery,
  explainRecovery
};

