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
  const TROY_OUNCE_TO_GRAM = 31.1034768;
  
  // Актуальні реалістичні резервні курси (грн / грам 999.9 чистоти)
  const fallbackMetals = {
    gold: 6324.98,      // Au 999.9 (~6325 грн/г)
    silver: 93.69,      // Ag 999.9 (~93.69 грн/г)
    platinum: 2520.50,  // Pt 999.9 (~2520 грн/г)
    palladium: 1908.45  // Pd 999.9 (~1908 грн/г)
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CastingCalc/2.0 (Jewelry Production Engine)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NBU API responded with status ${response.status}`);
    }

    const rawList = await response.json();
    const metals = { ...fallbackMetals };
    let exchangeDate = new Date().toLocaleDateString('uk-UA');

    if (Array.isArray(rawList)) {
      rawList.forEach(item => {
        if (!item || !item.rate) return;
        const ratePerOunce = parseFloat(item.rate);
        if (isNaN(ratePerOunce) || ratePerOunce <= 0) return;
        
        const ratePerGram = ratePerOunce / TROY_OUNCE_TO_GRAM;
        
        if (item.r030 === 959 || item.cc === 'XAU') {
          metals.gold = Number(ratePerGram.toFixed(2));
          if (item.exchangedate) exchangeDate = item.exchangedate;
        } else if (item.r030 === 961 || item.cc === 'XAG') {
          metals.silver = Number(ratePerGram.toFixed(2));
        } else if (item.r030 === 962 || item.cc === 'XPT') {
          metals.platinum = Number(ratePerGram.toFixed(2));
        } else if (item.r030 === 964 || item.cc === 'XPD') {
          metals.palladium = Number(ratePerGram.toFixed(2));
        }
      });
    }

    return res.json({
      success: true,
      source: 'nbu_live',
      date: exchangeDate,
      metals: metals,
      troyOunceGram: TROY_OUNCE_TO_GRAM,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.warn('NBU API fetch fallback:', err.message);
    return res.json({
      success: true,
      source: 'fallback',
      message: 'Використано актуальні довідкові курси дорогоцінних металів',
      date: new Date().toLocaleDateString('uk-UA'),
      metals: fallbackMetals,
      troyOunceGram: TROY_OUNCE_TO_GRAM,
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
