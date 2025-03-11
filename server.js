// server.js
const express = require("express");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const cors = require("cors");
const { Server: WebSocketServer } = require("ws");

dotenv.config();

// --- Field Mapping ---
// Map frontend field names to their CSS selectors.
// (Adjust selectors as needed.)
const mapping = {
  "Name": "div.mObvyAprzMQhIjyCYKseWKgPjGYfGfWonIA a.qWdktykoofflQLeAqgrGCGVRzijLcViJI span",
  "Profile": "a.qWdktykoofflQLeAqgrGCGVRzijLcViJI",
  "Photo": "img.presence-entity__image",
  "Headline": "div.FBhjEoyAzmTuyITebnedTzGaSyYHjnEDsjUEY",
  "Location": "div.AZoaSfcPFEqGecZFTogUQbRlYXHDrBLqvghsY",
  "Company": "div.someCompanySelector" // Adjust as needed.
};

// Global flag for cancellation.
let stopScraping = false;

// --- WebSocket Progress Broadcast ---
let wss; // We'll initialize this later.
function broadcastProgress(progress) {
  const message = JSON.stringify({ pagesScraped: progress });
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
}
function sendProgressUpdate(progress) {
  console.log(`Sending progress update: ${progress}`);
  broadcastProgress(progress);
}

// --- Scraper Functions ---
async function scrapePage(page, url, template, paginationMethod, pagesCount) {
  await page.goto(url, { waitUntil: "networkidle2" });
  let scrapedData = [];
  let hasNextPage = true;
  let currentPage = 0;

  if (paginationMethod === "next_button") {
    while (hasNextPage && currentPage < pagesCount) {
      await page.waitForSelector("body");

      // Extract data on current page.
      const data = await page.evaluate((template) => {
        const items = [];
        const searchContainer = document.querySelector(".search-results-container");
        if (!searchContainer) {
          console.error("Search results container not found.");
          return items;
        }
        const dynamicDivs = searchContainer.querySelectorAll("div[id]");
        if (dynamicDivs.length < 2) {
          console.error("Not enough dynamic divs found.");
          return items;
        }
        const searchListDiv = dynamicDivs[1];
        const ulElement = searchListDiv.querySelector(
          'ul[role="list"].wNevqcbRwwxOTFvsgFxLcPHEzidSiKfUWeg.list-style-none'
        );
        if (!ulElement) {
          console.error("UL element not found.");
          return items;
        }
        const results = ulElement.querySelectorAll("li");
        results.forEach(result => {
          const item = {};
          // For each field requested, extract the corresponding data.
          for (let key in template) {
            debugger;
            const element = result.querySelector(template[key]);
            if (element) {
              if (element.tagName.toLowerCase() === "img") {
                item[key] = element.getAttribute("src");
              } else if (element.tagName.toLowerCase() === "a") {
                item[key] = element.getAttribute("href");
              } else {
                item[key] = element.innerText.trim().split("\n")[0];
              }
            }
          }
          // Only push item if at least the "name" field exists.
          if (item.name) {
            items.push(item);
          }
        });
        return items;
      }, template);

      scrapedData = scrapedData.concat(data);
      currentPage++;
      sendProgressUpdate(currentPage);
      console.log(`Page ${currentPage}: Scraped ${data.length} items.`);

      // Attempt to click the "Next" button.
      const nextButtonSelector = 'button[aria-label="Next"]';
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await page.waitForSelector(nextButtonSelector, { visible: true, timeout: 5000 });
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          page.click(nextButtonSelector)
        ]);
      } catch (e) {
        console.log("Next button not found or not clickable. Ending pagination.");
        hasNextPage = false;
      }
    }
  } else if (paginationMethod === "infinite_scroll") {
    while (hasNextPage && !stopScraping) {
      await page.waitForSelector("body");

      const data = await page.evaluate((template) => {
        const items = [];
        const searchContainer = document.querySelector(".search-results-container");
        if (!searchContainer) {
          console.error("Search results container not found.");
          return items;
        }
        const dynamicDivs = searchContainer.querySelectorAll("div[id]");
        if (dynamicDivs.length < 2) {
          console.error("Not enough dynamic divs found.");
          return items;
        }
        const searchListDiv = dynamicDivs[1];
        const ulElement = searchListDiv.querySelector(
          'ul[role="list"].wNevqcbRwwxOTFvsgFxLcPHEzidSiKfUWeg.list-style-none'
        );
        if (!ulElement) {
          console.error("UL element not found.");
          return items;
        }
        const results = ulElement.querySelectorAll("li");
        results.forEach(result => {
          const item = {};
          for (let key in template) {
            const element = result.querySelector(template[key]);
            if (element) {
              if (element.tagName.toLowerCase() === "img") {
                item[key] = element.getAttribute("src");
              } else if (element.tagName.toLowerCase() === "a") {
                item[key] = element.getAttribute("href");
              } else {
                item[key] = element.innerText.trim().split("\n")[0];
              }
            }
          }
          if (item.name) {
            items.push(item);
          }
        });
        return items;
      }, template);

      scrapedData = scrapedData.concat(data);
      currentPage++;
      sendProgressUpdate(currentPage);
      console.log(`Page ${currentPage}: Scraped ${data.length} items.`);

      const previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) {
        console.log("Reached end of infinite scroll.");
        hasNextPage = false;
      }
    }
  }
  return scrapedData;
}

// Login helper
async function login(page) {
  await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
  await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, { delay: 50 });
  await page.type('input[name="session_password"]', process.env.LINKEDIN_PASSWORD, { delay: 50 });
  await page.click('button[type="submit"]');
  await page.waitForSelector(".application-outlet");
}

// --- Express Server Setup ---
const app = express();
app.use(express.json());
app.use(cors());

// POST /api/scrape endpoint
app.post("/api/scrape", async (req, res) => {
  const { url, fields, paginationMethod, pagesCount } = req.body;
  // Build a template from the selected fields.
  const template = {};
  fields.forEach(field => {
    if (mapping[field]) {
      // Use lower-case keys for consistency.
      template[field.toLowerCase()] = mapping[field];
    }
  });

  let browser;
  stopScraping = false; // reset cancellation flag
  try {
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Login to LinkedIn.
    await login(page);
    // Scrape the data.
    const scrapedData = await scrapePage(page, url, template, paginationMethod, pagesCount);
    res.json(scrapedData);
  } catch (error) {
    console.error("Error during scraping:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// POST /api/stop endpoint to cancel scraping.
app.post("/api/stop", (req, res) => {
  stopScraping = true;
  res.json({ message: "Scraping stopped" });
});

// Start Express server.
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

// --- WebSocket Server Setup ---
// Attach WebSocket server to the same HTTP server at path '/ws'.
wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  console.log("WebSocket client connected.");
  ws.on("close", () => {
    console.log("WebSocket client disconnected.");
  });
});
