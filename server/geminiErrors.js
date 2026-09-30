// Report actionable provider errors without returning API keys, project IDs or raw requests.
function geminiFailure(status, provider = {}, model = '') {
  const details = provider.details || [];
  const violations = details.flatMap(detail => Array.isArray(detail.violations) ? detail.violations : []);
  const quotas = [...new Set(violations.map(v => v.quotaId || v.quotaMetric).filter(v => typeof v === 'string'))];
  const retry = details.find(detail => typeof detail.retryDelay === 'string')?.retryDelay;
  const seconds = retry && /^\d+(?:\.\d+)?s$/.test(retry) ? Math.ceil(parseFloat(retry)) : null;
  const unavailable = /limit:\s*0\b/i.test(provider.message || '');
  const daily = quotas.some(q => /perday|daily/i.test(q));
  let message;
  if (status === 429) {
    message = unavailable
      ? 'Gemini reports a zero quota for this model or tool. The site owner needs to check this API project’s model access, quota and billing in Google AI Studio; retrying alone will not fix a zero quota.'
      : daily
        ? 'Gemini’s daily quota has been reached. Wait for the quota to reset or have the site owner check the project’s quota and billing in Google AI Studio.'
        : `Gemini rejected the request because a rate or quota limit was reached.${seconds ? ` Retry in ${seconds} seconds.` : ' Check the project’s usage and limits in Google AI Studio before retrying.'}`;
  } else if (status === 401 || status === 403) {
    message = 'Gemini rejected the server’s API credentials or permissions. The site owner needs to check GEMINI_API_KEY and this project’s model access.';
  } else if (status === 404) {
    message = 'The configured Gemini model is unavailable for this API endpoint. The site owner needs to check the server’s model setting.';
  } else if (status === 400) {
    message = 'Gemini rejected the request configuration. The site owner needs to check that the configured model supports the requested tools and inputs.';
  } else {
    message = 'Gemini is temporarily unavailable. Your saved content is safe; try again later.';
  }
  const error = new Error(message);
  error.status = status === 429 ? 429 : 502;
  error.code = status === 429 ? 'AI_QUOTA_LIMIT' : 'AI_PROVIDER_ERROR';
  error.diagnostics = { providerStatus: status, model, ...(seconds ? { retryAfterSeconds: seconds } : {}), ...(quotas.length ? { quotas: quotas.slice(0, 10) } : {}) };
  return error;
}
function sdkFailure(error, model) {
  if (Number.isInteger(error.status)) return geminiFailure(error.status, { details: error.errorDetails || [], message: error.message }, model);
  return error;
}
module.exports = { geminiFailure, sdkFailure };
