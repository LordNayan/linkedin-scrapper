const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

// Define a template mapping each field to a CSS selector.
// Adjust these selectors as needed based on the actual DOM structure.
const defaultTemplate = {
  name: "div.mObvyAprzMQhIjyCYKseWKgPjGYfGfWonIA a.qWdktykoofflQLeAqgrGCGVRzijLcViJI span",
  profileLink: "a.qWdktykoofflQLeAqgrGCGVRzijLcViJI",
  photoLink: "img.presence-entity__image",
  headline: "div.FBhjEoyAzmTuyITebnedTzGaSyYHjnEDsjUEY",
  location: "div.AZoaSfcPFEqGecZFTogUQbRlYXHDrBLqvghsY",
};

async function scrapePage(
  page,
  url,
  template = defaultTemplate,
  paginationMethod = "next_button",
) {
  await page.goto(url, { waitUntil: "networkidle2" });

  let scrapedData = [];
  let hasNextPage = true;

  while (hasNextPage) {
    await page.waitForSelector("body");

    // Extract data from the 2nd dynamic div's UL container.
    const data = await page.evaluate((template) => {
      const items = [];

      // 1. Select the stable container.
      const searchContainer = document.querySelector(".search-results-container");
      if (!searchContainer) {
        console.error("Search results container not found.");
        return items;
      }

      // 2. Capture all divs with an id inside the container.
      const dynamicDivs = searchContainer.querySelectorAll("div[id]");
      if (dynamicDivs.length < 2) {
        console.error("Not enough dynamic divs found in the search container.");
        return items;
      }

      // 3. Select the 2nd div (index 1).
      const searchListDiv = dynamicDivs[1];

      // 4. Find the UL element inside the target div.
      const ulElement = searchListDiv.querySelector(
        'ul[role="list"].wNevqcbRwwxOTFvsgFxLcPHEzidSiKfUWeg.list-style-none'
      );
      if (!ulElement) {
        console.error("UL element not found in the target div.");
        return items;
      }

      // 5. Select all list items (<li>) inside the UL element.
      const results = ulElement.querySelectorAll("li");
      for (const result of results) {
        const item = {};
        for (let field in template) {
          const element = result.querySelector(template[field]);
          if (element) {
            if (element.tagName.toLowerCase() === "img") {
              item[field] = element.getAttribute("src");
            } else if (element.tagName.toLowerCase() === "a") {
              item[field] = element.getAttribute("href");
            } else {
              item[field] = element.innerText.trim().split("\n")[0];
            }
          } else {
            break;
          }
        }
        if (item.name) {
          items.push(item);
        }
      }
      return items;
    }, template);

    scrapedData = scrapedData.concat(data);
    console.log(`Scraped ${data.length} items from current page.`);

    // Pagination logic
    if (paginationMethod === "next_button") {
      const nextButtonSelector = 'button[aria-label="Next"]';

      // Scroll to the bottom so the "Next" button becomes visible.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await new Promise(function(resolve) { 
        setTimeout(resolve, 1000)
        });

      try {
        await page.waitForSelector(nextButtonSelector, { visible: true, timeout: 5000 });
        console.log("Next button found. Clicking next...");
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          page.click(nextButtonSelector),
        ]);
      } catch (e) {
        console.log("Next button not found or not clickable. Ending pagination.");
        hasNextPage = false;
      }
    } else if (paginationMethod === "infinite_scroll") {
      const previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await page.waitForTimeout(2000);
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) {
        hasNextPage = false;
        console.log("Reached end of infinite scroll.");
      }
    } else {
      hasNextPage = false;
    }
  }
  return scrapedData;
}

// A helper function to log in to LinkedIn.
async function login(page) {
  // Navigate to LinkedIn's login page.
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle2",
  });

  // Type in your LinkedIn username and password.
  // It is best to store these in environment variables for security.
  await page.type('input[name="session_key"]', process.env.LINKEDIN_USERNAME, { delay: 50 });
  await page.type('input[name="session_password"]', process.env.LINKEDIN_PASSWORD, { delay: 50 });

  // Click the submit button and wait for navigation.
  await page.click('button[type="submit"]');
  await page.waitForSelector(".application-outlet");
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, devtools: true });
  const page = await browser.newPage();

  // Login to LinkedIn.
  await login(page);

  const url =
    "https://www.linkedin.com/search/results/people/?keywords=nayan&origin=SWITCH_SEARCH_VERTICAL&sid=~dQ";
  const paginationMethod = "next_button"; // or 'infinite_scroll'
  try {
    const results = await scrapePage(page, url, defaultTemplate, paginationMethod);
    console.log("Scraping completed. Output:");
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync("scrapedData.json", JSON.stringify(results, null, 2));
    console.log("Data saved to scrapedData.json");
  } catch (error) {
    console.error("Error during scraping:", error);
  }
})();
