// Records daily API usage and the most recently observed provider & model rate limits.
const mongoose = require('mongoose');

const dailyUsageSchema = new mongoose.Schema({
  _id: { type: String },
  provider: { type: String, required: true },
  service: { type: String, required: true },
  model: { type: String, required: true },
  date: { type: Date, required: true, expires: 90 * 24 * 60 * 60 },
  requests: { type: Number, default: 0 },
  succeeded: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  audioRequests: { type: Number, default: 0 },
  audioCharacters: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const rateLimitSchema = new mongoose.Schema({
  _id: { type: String }, // Format: `${provider}|${model}`
  provider: { type: String, required: true },
  service: { type: String, required: true },
  model: { type: String, required: true },
  requestLimit: Number,
  remainingRequests: Number,
  resetRequests: String,
  tokenLimit: Number,
  remainingTokens: Number,
  resetTokens: String,
  retryAfter: String,
  httpStatus: Number,
  observedAt: { type: Date, required: true }
}, { versionKey: false });

const DailyUsage = mongoose.models.ApiDailyUsage ||
  mongoose.model('ApiDailyUsage', dailyUsageSchema);
const RateLimit = mongoose.models.ApiRateLimit ||
  mongoose.model('ApiRateLimit', rateLimitSchema);

// Safely drop any legacy single-provider unique index in the background
if (mongoose.connection) {
  RateLimit.collection?.dropIndex('provider_1').catch(() => {});
}

// In-memory cache of rate limits and cool-offs for immediate routing decisions
const memoryRateLimits = new Map();

// Read a header from either Fetch Headers or a plain response-header object.
function header(response, name) {
  if (!response?.headers) return null;
  const value = typeof response.headers.get === 'function'
    ? response.headers.get(name)
    : response.headers[name] || response.headers[name.toLowerCase()];
  return value === undefined || value === null || value === '' ? null : String(value);
}

// Convert provider usage values to non-negative integer counts.
function finiteUsage(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
}

// Extract valid rate-limit headers across Groq, OpenRouter, and standard providers.
function rateLimitSnapshot(response) {
  if (!response) return null;

  const requestLimitRaw = header(response, 'x-ratelimit-limit-requests') ||
    header(response, 'ratelimit-limit-requests') ||
    header(response, 'ratelimit-limit');
  const remainingRequestsRaw = header(response, 'x-ratelimit-remaining-requests') ||
    header(response, 'ratelimit-remaining-requests') ||
    header(response, 'ratelimit-remaining');
  const resetRequestsRaw = header(response, 'x-ratelimit-reset-requests') ||
    header(response, 'ratelimit-reset-requests') ||
    header(response, 'ratelimit-reset');

  const tokenLimitRaw = header(response, 'x-ratelimit-limit-tokens') ||
    header(response, 'ratelimit-limit-tokens');
  const remainingTokensRaw = header(response, 'x-ratelimit-remaining-tokens') ||
    header(response, 'ratelimit-remaining-tokens');
  const resetTokensRaw = header(response, 'x-ratelimit-reset-tokens') ||
    header(response, 'ratelimit-reset-tokens');

  const retryAfterRaw = header(response, 'retry-after');

  const values = {
    requestLimit: requestLimitRaw !== null ? Number(requestLimitRaw) : null,
    remainingRequests: remainingRequestsRaw !== null ? Number(remainingRequestsRaw) : null,
    resetRequests: resetRequestsRaw,
    tokenLimit: tokenLimitRaw !== null ? Number(tokenLimitRaw) : null,
    remainingTokens: remainingTokensRaw !== null ? Number(remainingTokensRaw) : null,
    resetTokens: resetTokensRaw,
    retryAfter: retryAfterRaw
  };

  const numberFields = ['requestLimit', 'remainingRequests', 'tokenLimit', 'remainingTokens'];
  for (const field of numberFields) {
    if (values[field] !== null) {
      const numeric = Number(values[field]);
      values[field] = Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
    }
  }

  // If status is 429, ensure retryAfter or status flag is recorded
  if (response.status === 429 && !values.retryAfter) {
    values.retryAfter = 'rate_limited';
  }

  return (Object.values(values).some(v => v !== null) || response.status === 429) ? values : null;
}

// Parse retry-after header value into milliseconds
function parseRetryAfterMs(retryAfterStr) {
  if (!retryAfterStr) return 0;
  const num = Number(retryAfterStr);
  if (Number.isFinite(num) && num > 0) return num * 1000;
  const parsedDate = Date.parse(retryAfterStr);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }
  return 30000; // Default 30s backoff when unparseable
}

// Check if a specific provider/model is currently known to be rate limited
function isRateLimited(provider, model = null) {
  const now = Date.now();
  for (const [key, entry] of memoryRateLimits.entries()) {
    if (entry.provider !== provider) continue;
    if (model && entry.model !== model) continue;

    // If active 429 cool-off
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return { limited: true, reason: 'active_429', remainingMs: entry.blockedUntil - now };
    }
    // If remaining requests is 0
    if (entry.remainingRequests === 0) {
      return { limited: true, reason: 'requests_exhausted', reset: entry.resetRequests };
    }
    // If remaining tokens is critically low (< 50)
    if (entry.remainingTokens !== null && entry.remainingTokens < 50) {
      return { limited: true, reason: 'tokens_exhausted', reset: entry.resetTokens };
    }
  }
  return { limited: false };
}

// Increment the UTC daily usage bucket and refresh rate-limit snapshots for any provider/model
async function recordUsage({
  provider = 'groq',
  service = 'chat',
  model = 'unknown',
  response = null,
  usage = null,
  audioCharacters = 0
}) {
  const safeProvider = String(provider || 'unknown').toLowerCase().slice(0, 40);
  const safeService = String(service || 'unknown').toLowerCase().slice(0, 40);
  const safeModel = String(model || 'unknown').slice(0, 120);

  const promptTokens = finiteUsage(usage?.prompt_tokens ?? usage?.input_tokens);
  const completionTokens = finiteUsage(usage?.completion_tokens ?? usage?.output_tokens);
  const totalTokens = finiteUsage(usage?.total_tokens) || (promptTokens + completionTokens);

  const isOk = Boolean(response?.ok);
  const isFailed = response ? !response.ok : false;
  const httpStatus = response?.status || null;

  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const recordId = `${safeProvider}|${safeService}|${safeModel}|${day.toISOString().slice(0, 10)}`;

  // Update in-memory rate-limit state
  const limits = rateLimitSnapshot(response);
  const memKey = `${safeProvider}|${safeModel}`;
  const existingMem = memoryRateLimits.get(memKey) || { provider: safeProvider, model: safeModel };

  let blockedUntil = null;
  if (httpStatus === 429) {
    const delayMs = limits?.retryAfter ? parseRetryAfterMs(limits.retryAfter) : 20000;
    blockedUntil = Date.now() + Math.max(5000, delayMs);
  } else if (isOk) {
    blockedUntil = null;
  }

  memoryRateLimits.set(memKey, {
    ...existingMem,
    ...(limits || {}),
    provider: safeProvider,
    service: safeService,
    model: safeModel,
    httpStatus,
    blockedUntil,
    observedAt: now
  });

  if (mongoose.connection.readyState !== 1) {
    return; // Don't crash if DB is offline; in-memory tracking remains operational
  }

  await DailyUsage.updateOne(
    { _id: recordId },
    {
      $setOnInsert: {
        provider: safeProvider,
        service: safeService,
        model: safeModel,
        date: day
      },
      $inc: {
        requests: 1,
        succeeded: isOk ? 1 : 0,
        failed: isFailed ? 1 : 0,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        totalTokens,
        audioRequests: audioCharacters > 0 ? 1 : 0,
        audioCharacters: finiteUsage(audioCharacters)
      },
      $set: { updatedAt: now }
    },
    { upsert: true }
  );

  if (limits || httpStatus === 429) {
    const rateLimitId = `${safeProvider}|${safeModel}`;
    await RateLimit.findOneAndUpdate(
      { _id: rateLimitId },
      {
        $set: {
          provider: safeProvider,
          service: safeService,
          model: safeModel,
          ...(limits || {}),
          httpStatus,
          observedAt: now
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

// Backward-compatible Groq recorder
async function recordGroqUsage(entry) {
  return recordUsage({ provider: 'groq', ...entry });
}

// Safe recorder that never crashes the caller
async function recordApiUsageSafely(entry) {
  try {
    await recordUsage(entry);
  } catch (err) {
    console.error(`[API Usage] Failed to record ${entry.provider || 'API'} ${entry.service || ''} usage:`, err.message);
  }
}

// Backward-compatible Groq safe recorder
async function recordGroqUsageSafely(entry) {
  return recordApiUsageSafely({ provider: 'groq', ...entry });
}

// Aggregate recent daily usage across ALL providers and models
async function getApiUsage(days = 30) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('API usage is unavailable while MongoDB is disconnected.');
  }
  const periodDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)));
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - periodDays + 1);

  const [byServiceRaw, byModelRaw, byProviderRaw, rateLimitsDocs] = await Promise.all([
    DailyUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$service',
          requests: { $sum: '$requests' },
          succeeded: { $sum: '$succeeded' },
          failed: { $sum: '$failed' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          totalTokens: { $sum: '$totalTokens' },
          audioRequests: { $sum: '$audioRequests' },
          audioCharacters: { $sum: '$audioCharacters' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    DailyUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { provider: '$provider', service: '$service', model: '$model' },
          requests: { $sum: '$requests' },
          succeeded: { $sum: '$succeeded' },
          failed: { $sum: '$failed' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          totalTokens: { $sum: '$totalTokens' },
          audioRequests: { $sum: '$audioRequests' },
          audioCharacters: { $sum: '$audioCharacters' }
        }
      },
      { $sort: { '_id.provider': 1, '_id.model': 1 } }
    ]),
    DailyUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$provider',
          requests: { $sum: '$requests' },
          succeeded: { $sum: '$succeeded' },
          failed: { $sum: '$failed' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          totalTokens: { $sum: '$totalTokens' },
          audioRequests: { $sum: '$audioRequests' },
          audioCharacters: { $sum: '$audioCharacters' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    RateLimit.find({}).lean()
  ]);

  const totals = byProviderRaw.reduce((sum, item) => {
    for (const field of [
      'requests', 'succeeded', 'failed', 'inputTokens', 'outputTokens',
      'totalTokens', 'audioRequests', 'audioCharacters'
    ]) {
      sum[field] += item[field] || 0;
    }
    return sum;
  }, {
    requests: 0,
    succeeded: 0,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    audioRequests: 0,
    audioCharacters: 0
  });

  const byModel = byModelRaw.map(item => ({
    provider: item._id.provider,
    service: item._id.service,
    model: item._id.model,
    requests: item.requests,
    succeeded: item.succeeded,
    failed: item.failed,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    totalTokens: item.totalTokens,
    audioRequests: item.audioRequests,
    audioCharacters: item.audioCharacters
  }));

  const byProvider = byProviderRaw.map(item => ({
    provider: item._id,
    requests: item.requests,
    succeeded: item.succeeded,
    failed: item.failed,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    totalTokens: item.totalTokens,
    audioRequests: item.audioRequests,
    audioCharacters: item.audioCharacters
  }));

  const byService = byServiceRaw.map(item => ({
    service: item._id,
    requests: item.requests,
    succeeded: item.succeeded,
    failed: item.failed,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    totalTokens: item.totalTokens,
    audioRequests: item.audioRequests,
    audioCharacters: item.audioCharacters
  }));

  const rateLimits = rateLimitsDocs.map(r => ({
    provider: r.provider,
    service: r.service,
    model: r.model,
    requestLimit: r.requestLimit ?? null,
    remainingRequests: r.remainingRequests ?? null,
    resetRequests: r.resetRequests ?? null,
    tokenLimit: r.tokenLimit ?? null,
    remainingTokens: r.remainingTokens ?? null,
    resetTokens: r.resetTokens ?? null,
    retryAfter: r.retryAfter ?? null,
    httpStatus: r.httpStatus ?? null,
    observedAt: r.observedAt
  }));

  // Primary rate limit for backward compatibility (prefer Groq, else first)
  const primaryRateLimit = rateLimits.find(r => r.provider === 'groq') || rateLimits[0] || null;

  return {
    periodDays,
    startDate: startDate.toISOString(),
    totals,
    byProvider,
    byModel,
    byService,
    rateLimits,
    rateLimit: primaryRateLimit // Backwards compatibility for single-provider views
  };
}

// Backward-compatible Groq-specific getter
async function getGroqUsage(days = 30) {
  const full = await getApiUsage(days);
  return {
    periodDays: full.periodDays,
    startDate: full.startDate,
    totals: full.totals,
    byService: full.byService,
    byModel: full.byModel,
    byProvider: full.byProvider,
    rateLimits: full.rateLimit,
    allRateLimits: full.rateLimits
  };
}

module.exports = {
  DailyUsage,
  RateLimit,
  recordUsage,
  recordApiUsageSafely,
  recordGroqUsage,
  recordGroqUsageSafely,
  getApiUsage,
  getGroqUsage,
  isRateLimited,
  rateLimitSnapshot
};
