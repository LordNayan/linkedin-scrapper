// server.js

const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const cors = require("cors");
const { Server: WebSocketServer } = require("ws");

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Predefined mapping from field names to CSS selectors.
const fieldMappings = {
  Name: "div.mObvyAprzMQhIjyCYKseWKgPjGYfGfWonIA a.qWdktykoofflQLeAqgrGCGVRzijLcViJI span",
  Profile: "a.qWdktykoofflQLeAqgrGCGVRzijLcViJI",
  Photo: "img.presence-entity__image",
  Headline: "div.FBhjEoyAzmTuyITebnedTzGaSyYHjnEDsjUEY",
  Company: "div.someCompanyClass", // Update with an appropriate selector.
  Location: "div.AZoaSfcPFEqGecZFTogUQbRlYXHDrBLqvghsY",
};

// Global flag for cancellation.
let stopScraping = false;

// --- Set up WebSocket Server ---
let webSocketClients = [];
const wss = new WebSocketServer({ port: 4000 });
wss.on("connection", (ws) => {
  webSocketClients.push(ws);
  ws.on("close", () => {
    webSocketClients = webSocketClients.filter((client) => client !== ws);
  });
});

// Broadcast a message to all connected WebSocket clients.
function broadcast(message) {
  webSocketClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}

// --- Scraping Function ---
async function scrapePage(page, url, template, paginationMethod, pagesCount) {
  await page.goto(url, { waitUntil: "networkidle2" });

  let scrapedData = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (
    hasNextPage &&
    !stopScraping &&
    (paginationMethod === "infinite_scroll" || currentPage <= pagesCount)
  ) {
    // Extract page data using the provided template.
    let pageData = await page.evaluate((template) => {
      const items = [];
      const searchContainer = document.querySelector(
        ".search-results-container"
      );
      if (!searchContainer) return items;
      const dynamicDivs = searchContainer.querySelectorAll("div[id]");
      if (dynamicDivs.length < 2) return items;
      const searchListDiv = dynamicDivs[1];
      const ulElement = searchListDiv.querySelector(
        'ul[role="list"].wNevqcbRwwxOTFvsgFxLcPHEzidSiKfUWeg.list-style-none'
      );
      if (!ulElement) return items;
      const results = ulElement.querySelectorAll("li");
      results.forEach((result) => {
        let item = {};
        for (let field in template) {
          let element = result.querySelector(template[field]);
          if (element) {
            if (element.tagName.toLowerCase() === "img") {
              item[field] = element.getAttribute("src");
            } else if (element.tagName.toLowerCase() === "a") {
              item[field] = element.getAttribute("href");
            } else {
              item[field] = element.innerText.trim().split("\n")[0];
            }
          }
        }
        if (Object.keys(item).length > 0) items.push(item);
      });
      return items;
    }, template);

    // If the first page returns zero results, wait and retry once.
    if (currentPage === 1 && pageData.length === 0) {
      await sleep(2000);
      pageData = await page.evaluate((template) => {
        const items = [];
        const searchContainer = document.querySelector(
          ".search-results-container"
        );
        if (!searchContainer) return items;
        const dynamicDivs = searchContainer.querySelectorAll("div[id]");
        if (dynamicDivs.length < 2) return items;
        const searchListDiv = dynamicDivs[1];
        const ulElement = searchListDiv.querySelector(
          'ul[role="list"].wNevqcbRwwxOTFvsgFxLcPHEzidSiKfUWeg.list-style-none'
        );
        if (!ulElement) return items;
        const results = ulElement.querySelectorAll("li");
        results.forEach((result) => {
          let item = {};
          for (let field in template) {
            let element = result.querySelector(template[field]);
            if (element) {
              if (element.tagName.toLowerCase() === "img") {
                item[field] = element.getAttribute("src");
              } else if (element.tagName.toLowerCase() === "a") {
                item[field] = element.getAttribute("href");
              } else {
                item[field] = element.innerText.trim().split("\n")[0];
              }
            }
          }
          if (Object.keys(item).length > 0) items.push(item);
        });
        return items;
      }, template);
    }

    scrapedData = scrapedData.concat(pageData);
    // Broadcast the progress update including pages scraped count and data for this page.
    broadcast(
      JSON.stringify({
        pagesScraped: currentPage,
        pageData,
        stopScraping: false,
      })
    );

    currentPage++;

    // Pagination handling.
    if (paginationMethod === "next_button") {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1000);
      const nextButton = await page.$('button[aria-label="Next"]');
      if (nextButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          nextButton.click(),
        ]);
      } else {
        hasNextPage = false;
      }
    } else if (paginationMethod === "infinite_scroll") {
      let previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await sleep(2000);
      let newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }
  }

  broadcast(JSON.stringify({ stopScraping: true }));
  return scrapedData;
}

// Login helper
async function login(page) {
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle2",
  });
  await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, {
    delay: 50,
  });
  await page.type(
    'input[name="session_password"]',
    process.env.LINKEDIN_PASSWORD,
    { delay: 50 }
  );
  await page.click('button[type="submit"]');
  await page.waitForSelector(".application-outlet");
}

// --- API Endpoint ---
app.post("/api/scrape", async (req, res) => {
  const { url, fields, paginationMethod, pagesCount } = req.body;
  if (!url || !fields || fields.length === 0) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  // Build the template object using the field mappings.
  const template = {};
  fields.forEach((field) => {
    if (fieldMappings[field]) {
      template[field] = fieldMappings[field];
    }
  });

  let browser;
  stopScraping = false; // reset cancellation flag

  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Login to LinkedIn.
    await login(page);

    // Scrape the data.
    const data = await scrapePage(
      page,
      url,
      template,
      paginationMethod,
      pagesCount
    );
    await browser.close();

    res.json({
      data,
      pagesScraped: paginationMethod === "next_button" ? pagesCount : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stop endpoint to cancel scraping.
app.post("/api/stop", (req, res) => {
  stopScraping = true;
  res.json({ message: "Scraping stopped" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});

async function sleep(ms) {
  return await new Promise((resolve, reject) => setTimeout(resolve, ms));
}
