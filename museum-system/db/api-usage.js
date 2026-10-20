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
  provider: { type: String, required: true, unique: true },
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

function header(response, name) {
  if (!response?.headers) return null;
  const value = typeof response.headers.get === 'function'
    ? response.headers.get(name)
    : response.headers[name] || response.headers[name.toLowerCase()];
  return value === undefined || value === null || value === '' ? null : String(value);
}

function finiteUsage(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
}

function rateLimitSnapshot(response) {
  const values = {
    requestLimit: header(response, 'x-ratelimit-limit-requests'),
    remainingRequests: header(response, 'x-ratelimit-remaining-requests'),
    resetRequests: header(response, 'x-ratelimit-reset-requests'),
    tokenLimit: header(response, 'x-ratelimit-limit-tokens'),
    remainingTokens: header(response, 'x-ratelimit-remaining-tokens'),
    resetTokens: header(response, 'x-ratelimit-reset-tokens'),
    retryAfter: header(response, 'retry-after')
  };
  const numberFields = ['requestLimit', 'remainingRequests', 'tokenLimit', 'remainingTokens'];
  for (const field of numberFields) {
    if (values[field] !== null) {
      const numeric = Number(values[field]);
      values[field] = Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
    }
  }
  return Object.values(values).some(value => value !== null) ? values : null;
}

async function recordGroqUsage({ service, model, response = null, usage = null, audioCharacters = 0 }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('API usage cannot be recorded while MongoDB is disconnected.');
  }

  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const safeService = String(service || 'unknown').slice(0, 40);
  const safeModel = String(model || 'unknown').slice(0, 120);
  const promptTokens = finiteUsage(usage?.prompt_tokens ?? usage?.input_tokens);
  const completionTokens = finiteUsage(usage?.completion_tokens ?? usage?.output_tokens);
  const totalTokens = finiteUsage(usage?.total_tokens) || promptTokens + completionTokens;
  const recordId = `groq|${safeService}|${safeModel}|${day.toISOString().slice(0, 10)}`;

  await DailyUsage.updateOne(
    { _id: recordId },
    {
      $setOnInsert: {
        provider: 'groq',
        service: safeService,
        model: safeModel,
        date: day
      },
      $inc: {
        requests: 1,
        succeeded: response?.ok ? 1 : 0,
        failed: response ? (response.ok ? 0 : 1) : 1,
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

  const limits = rateLimitSnapshot(response);
  if (limits) {
    await RateLimit.findOneAndUpdate(
      { provider: 'groq' },
      {
        $set: {
          ...limits,
          service: safeService,
          model: safeModel,
          httpStatus: response?.status || null,
          observedAt: now
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

async function getGroqUsage(days = 30) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('API usage is unavailable while MongoDB is disconnected.');
  }
  const periodDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)));
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - periodDays + 1);

  const [byService, rateLimits] = await Promise.all([
    DailyUsage.aggregate([
      { $match: { provider: 'groq', date: { $gte: startDate } } },
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
    RateLimit.findOne({ provider: 'groq' }).lean()
  ]);

  const totals = byService.reduce((sum, service) => {
    for (const field of [
      'requests', 'succeeded', 'failed', 'inputTokens', 'outputTokens',
      'totalTokens', 'audioRequests', 'audioCharacters'
    ]) {
      sum[field] += service[field] || 0;
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

  return {
    periodDays,
    startDate: startDate.toISOString(),
    totals,
    byService: byService.map(({ _id, ...service }) => ({ service: _id, ...service })),
    rateLimits: rateLimits ? {
      service: rateLimits.service,
      model: rateLimits.model,
      requestLimit: rateLimits.requestLimit ?? null,
      remainingRequests: rateLimits.remainingRequests ?? null,
      resetRequests: rateLimits.resetRequests ?? null,
      tokenLimit: rateLimits.tokenLimit ?? null,
      remainingTokens: rateLimits.remainingTokens ?? null,
      resetTokens: rateLimits.resetTokens ?? null,
      retryAfter: rateLimits.retryAfter ?? null,
      httpStatus: rateLimits.httpStatus ?? null,
      observedAt: rateLimits.observedAt
    } : null
  };
}

async function recordGroqUsageSafely(entry) {
  try {
    await recordGroqUsage(entry);
  } catch (err) {
    console.error(`[API Usage] Failed to record Groq ${entry.service} usage:`, err.message);
  }
}

module.exports = {
  DailyUsage,
  RateLimit,
  recordGroqUsage,
  recordGroqUsageSafely,
  getGroqUsage
};
