const CACHE_TTL_MS = 5 * 60 * 1000;
const WINDOW_SIZE = 7;
const MIN_TARGET_SAMPLES = 3;

let cachedForecast = null;
let cachedAt = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sigmoid = (value) => 1 / (1 + Math.exp(-clamp(value, -30, 30)));
const tanh = (value) => Math.tanh(clamp(value, -30, 30));
const seededWeight = (seed) => Math.sin(seed * 999) * 0.08;

const createModel = (seed = 1) => ({
  Wf: seededWeight(seed + 1),
  Uf: seededWeight(seed + 2),
  bf: 0.4,
  Wi: seededWeight(seed + 3),
  Ui: seededWeight(seed + 4),
  bi: 0.05,
  Wo: seededWeight(seed + 5),
  Uo: seededWeight(seed + 6),
  bo: 0.05,
  Wg: seededWeight(seed + 7),
  Ug: seededWeight(seed + 8),
  bg: 0,
  Wy: seededWeight(seed + 9),
  by: 0,
});

const forward = (model, sequence) => {
  let h = 0;
  let c = 0;
  const steps = [];

  sequence.forEach((x) => {
    const hPrev = h;
    const cPrev = c;
    const f = sigmoid(model.Wf * x + model.Uf * hPrev + model.bf);
    const i = sigmoid(model.Wi * x + model.Ui * hPrev + model.bi);
    const o = sigmoid(model.Wo * x + model.Uo * hPrev + model.bo);
    const g = tanh(model.Wg * x + model.Ug * hPrev + model.bg);
    c = f * cPrev + i * g;
    h = o * tanh(c);
    steps.push({ x, hPrev, cPrev, f, i, o, g, c, h });
  });

  return { prediction: sigmoid(model.Wy * h + model.by), steps, h };
};

const zeroGradients = () => ({
  Wf: 0, Uf: 0, bf: 0,
  Wi: 0, Ui: 0, bi: 0,
  Wo: 0, Uo: 0, bo: 0,
  Wg: 0, Ug: 0, bg: 0,
  Wy: 0, by: 0,
});

const addGradient = (gradients, key, value) => {
  gradients[key] += clamp(value, -5, 5);
};

const trainModel = (samples, seed) => {
  const model = createModel(seed);
  const epochs = samples.length < 12 ? 260 : 180;
  const learningRate = samples.length < 12 ? 0.045 : 0.028;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    samples.forEach(({ sequence, target }) => {
      const { prediction, steps, h } = forward(model, sequence);
      const gradients = zeroGradients();
      const outputGradient = 2 * (prediction - target) * prediction * (1 - prediction);

      addGradient(gradients, 'Wy', outputGradient * h);
      addGradient(gradients, 'by', outputGradient);

      let dhNext = outputGradient * model.Wy;
      let dcNext = 0;

      for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index];
        const tanhCell = tanh(step.c);
        const dc = dhNext * step.o * (1 - tanhCell * tanhCell) + dcNext;
        const doRaw = dhNext * tanhCell * step.o * (1 - step.o);
        const dfRaw = dc * step.cPrev * step.f * (1 - step.f);
        const diRaw = dc * step.g * step.i * (1 - step.i);
        const dgRaw = dc * step.i * (1 - step.g * step.g);

        addGradient(gradients, 'Wf', dfRaw * step.x);
        addGradient(gradients, 'Uf', dfRaw * step.hPrev);
        addGradient(gradients, 'bf', dfRaw);
        addGradient(gradients, 'Wi', diRaw * step.x);
        addGradient(gradients, 'Ui', diRaw * step.hPrev);
        addGradient(gradients, 'bi', diRaw);
        addGradient(gradients, 'Wo', doRaw * step.x);
        addGradient(gradients, 'Uo', doRaw * step.hPrev);
        addGradient(gradients, 'bo', doRaw);
        addGradient(gradients, 'Wg', dgRaw * step.x);
        addGradient(gradients, 'Ug', dgRaw * step.hPrev);
        addGradient(gradients, 'bg', dgRaw);

        dhNext =
          dfRaw * model.Uf +
          diRaw * model.Ui +
          doRaw * model.Uo +
          dgRaw * model.Ug;
        dcNext = dc * step.f;
      }

      Object.keys(gradients).forEach((key) => {
        model[key] -= learningRate * gradients[key];
      });
    });
  }

  return model;
};

const normalizeLoad = (value) => clamp(Number(value) || 0, 0, 1);

const buildSeriesMaps = (rows) => {
  const hourly = new Map();
  const weekdays = new Map();
  const futureHourly = new Map();
  const futureWeekdays = new Map();
  const all = [];

  rows.forEach((row) => {
    const washType = row.wash_type === 'robot' ? 'robot' : 'manual';
    const totalSlots = Math.max(Number(row.total_slots) || 1, 1);
    const load = normalizeLoad(row.occupied_slots / totalSlots);
    const hourKey = `${row.hour}:${washType}`;
    const weekdayKey = `${row.day_of_week}:${washType}`;

    if (row.is_future) {
      if (!futureHourly.has(hourKey)) futureHourly.set(hourKey, []);
      if (!futureWeekdays.has(weekdayKey)) futureWeekdays.set(weekdayKey, []);
      futureHourly.get(hourKey).push(load);
      futureWeekdays.get(weekdayKey).push(load);
      return;
    }

    all.push(load);
    if (!hourly.has(hourKey)) hourly.set(hourKey, []);
    if (!weekdays.has(weekdayKey)) weekdays.set(weekdayKey, []);
    hourly.get(hourKey).push(load);
    weekdays.get(weekdayKey).push(load);
  });

  return { hourly, weekdays, futureHourly, futureWeekdays, all };
};

const makeSamples = (series) => {
  const samples = [];
  for (let index = WINDOW_SIZE; index < series.length; index += 1) {
    samples.push({
      sequence: series.slice(index - WINDOW_SIZE, index),
      target: series[index],
    });
  }
  return samples;
};

const fallbackSeries = (fallback) => {
  return Array.from({ length: WINDOW_SIZE + 4 }, (_, index) => {
    const wave = Math.sin(index * 0.9) * 0.04;
    return clamp(fallback + wave, 0.05, 0.95);
  });
};

const predictBucket = ({ series, futureSeries = [], fallback, seed }) => {
  const knownSeries = [...series, ...futureSeries];
  const targetSeries = knownSeries.length >= WINDOW_SIZE + 1 ? knownSeries : fallbackSeries(fallback);
  const localSamples = makeSamples(targetSeries);
  const samples = localSamples.slice(-24);

  if (samples.length < MIN_TARGET_SAMPLES) return Math.round(fallback * 100);

  const model = trainModel(samples, seed);
  const lastWindow = targetSeries.slice(-WINDOW_SIZE);
  const { prediction } = forward(model, lastWindow);

  return clamp(Math.round(prediction * 100), 3, 97);
};

const hashSeed = (key) => [...key].reduce((seed, char) => seed + char.charCodeAt(0), 17);

export const buildLstmLoadForecast = (rows, { forceRefresh = false } = {}) => {
  const now = Date.now();
  if (!forceRefresh && cachedForecast && now - cachedAt < CACHE_TTL_MS) {
    return cachedForecast;
  }

  const {
    hourly: hourlySeries,
    weekdays: weekdaySeries,
    futureHourly,
    futureWeekdays,
  } = buildSeriesMaps(rows);
  const hours = Array.from({ length: 12 }, (_, index) => index + 9);
  const weekdays = [
    { day: 1, label: 'Пн' },
    { day: 2, label: 'Вт' },
    { day: 3, label: 'Ср' },
    { day: 4, label: 'Чт' },
    { day: 5, label: 'Пт' },
    { day: 6, label: 'Сб' },
    { day: 0, label: 'Вс' },
  ];

  const getPrediction = ({ key, map, fallback }) =>
    predictBucket({
      series: map.get(key) ?? [],
      futureSeries: map === hourlySeries
        ? futureHourly.get(key) ?? []
        : futureWeekdays.get(key) ?? [],
      fallback,
      seed: hashSeed(key),
    });

  const hourly = hours.map((hour) => ({
    label: `${hour}:00`,
    manual: getPrediction({ key: `${hour}:manual`, map: hourlySeries, fallback: 0.34 }),
    robot: getPrediction({ key: `${hour}:robot`, map: hourlySeries, fallback: 0.28 }),
  }));

  const weekdaysData = weekdays.map((item) => ({
    label: item.label,
    manual: getPrediction({ key: `${item.day}:manual`, map: weekdaySeries, fallback: 0.36 }),
    robot: getPrediction({ key: `${item.day}:robot`, map: weekdaySeries, fallback: 0.3 }),
  }));

  cachedForecast = {
    model: 'LSTM trained on booking history',
    trained_on_points: rows.length,
    window_size: WINDOW_SIZE,
    hourly,
    weekdays: weekdaysData,
  };
  cachedAt = now;

  return cachedForecast;
};

export const clearLstmForecastCache = () => {
  cachedForecast = null;
  cachedAt = 0;
};
