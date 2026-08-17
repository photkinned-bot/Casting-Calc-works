import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(__dirname, { etag: false, maxAge: 0 }));

app.get('/api/nbu-metals', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/bankmetals?json', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CastingCalc/1.0 (Jewelry Production Engine)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NBU API responded with status ${response.status}`);
    }

    const data = await response.json();
    return res.json({ success: true, source: 'nbu_live', data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.warn('NBU API fetch fallback:', err.message);
    // Fallback current realistic reference rates
    const fallbackRates = [
      { r030: 959, txt: "Золото", rate: 3875.50, cc: "XAU", perGram: true },
      { r030: 961, txt: "Срібло", rate: 46.80, cc: "XAG", perGram: true },
      { r030: 962, txt: "Платина", rate: 1360.00, cc: "XPT", perGram: true },
      { r030: 964, txt: "Паладій", rate: 1250.00, cc: "XPD", perGram: true }
    ];
    return res.json({
      success: true,
      source: 'fallback',
      message: 'Використано актуальні довідкові курси дорогоцінних металів',
      data: fallbackRates,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Casting Calc running on http://0.0.0.0:${PORT}`);
});
