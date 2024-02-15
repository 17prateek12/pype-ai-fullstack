const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
// Cache expiration time in seconds
const CACHE_EXPIRATION_TIME = 60;

// Cache object
const cache = {};

// Helper function to fetch quotes from a single source
const fetchQuotesFromSource = async (source) => {
  try {
    const response = await axios.get(source);
    const $ = cheerio.load(response.data);

    let buyPrice, sellPrice;

    if (source === 'https://dolarhoy.com/') {
      buyPrice = parseFloat($('.compra .val').text().replace('$', '').replace(',', ''));
      sellPrice = parseFloat($('.venta .val').text().replace('$', '').replace(',', ''));
    } else if (source === 'https://www.cronista.com/MercadosOnline/moneda.html?id=ARSB') {
      buyPrice = parseFloat($('.buy-value').text().replace('$', '')) * 1000;
      sellPrice = parseFloat($('.sell-value').text().replace('$', '')) * 1000;
    }

    return {
      buy_price: buyPrice,
      sell_price: sellPrice,
      source: source,
    };
  } catch (error) {
    console.error(`Error fetching quotes from ${source}: ${error.message}`);
    return null;
  }
};

// Middleware to check cache before fetching quotes
const checkCache = (req, res, next) => {
  const cachedData = cache[req.url];

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRATION_TIME * 1000) {
    res.json(cachedData.data);
  } else {
    next();
  }
};

app.get('/quotes', checkCache, async (req, res) => {
  try {
    const sources = [
      'https://dolarhoy.com/',
      'https://www.cronista.com/MercadosOnline/moneda.html?id=ARSB',
    ];

    const quotes = await Promise.all(sources.map(fetchQuotesFromSource));
    const validQuotes = quotes.filter((quote) => quote !== null);

    if (validQuotes.length === 0) {
      res.status(404).json({ error: 'No valid quotes found' });
    } else {
      cache[req.url] = {
        data: validQuotes,
        timestamp: Date.now(),
      };

      res.json(validQuotes);
    }
  } catch (error) {
    console.error('Error fetching quotes:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/average', checkCache, async (req, res) => {
  try {
    const sources = [
      'https://dolarhoy.com/',
      'https://www.cronista.com/MercadosOnline/moneda.html?id=ARSB',
    ];

    const quotes = await Promise.all(sources.map(fetchQuotesFromSource));
    const validQuotes = quotes.filter((quote) => quote !== null);

    if (validQuotes.length === 0) {
      res.status(404).json({ error: 'No valid quotes found' });
    } else {
      cache[req.url] = {
        data: validQuotes,
        timestamp: Date.now(),
      };

      const totalBuyPrice = validQuotes.reduce((sum, quote) => sum + quote.buy_price, 0);
      const totalSellPrice = validQuotes.reduce((sum, quote) => sum + quote.sell_price, 0);

      const averageBuyPrice = totalBuyPrice / validQuotes.length;
      const averageSellPrice = totalSellPrice / validQuotes.length;

      res.json({
        average_buy_price: averageBuyPrice,
        average_sell_price: averageSellPrice,
      });
    }
  } catch (error) {
    console.error('Error calculating average:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
