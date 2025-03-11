import React, { useState, useEffect } from "react";
import "./App.css";

const predefinedFields = [
  "Name",
  "Profile",
  "Photo",
  "Headline",
  "Company",
  "Location",
];

function App() {
  const [url, setUrl] = useState("");
  const [selectedFields, setSelectedFields] = useState([]);
  const [paginationMethod, setPaginationMethod] = useState("next_button");
  const [pagesCount, setPagesCount] = useState(1);
  const [scrapedData, setScrapedData] = useState(null);
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [ws, setWs] = useState(null);

  // Validate that URL is a proper LinkedIn URL.
  const isValidLinkedInUrl = (link) => {
    const regex = /^https:\/\/(www\.)?linkedin\.com\/.+/;
    return regex.test(link);
  };

  // Toggle field selection.
  const handleFieldToggle = (field) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  // Select or clear all fields.
  const handleSelectAll = () => setSelectedFields(predefinedFields);
  const handleClearAll = () => setSelectedFields([]);

  // Connect to a WebSocket endpoint for real-time progress updates.
  useEffect(() => {
    if (isScraping) {
      const socket = new WebSocket("ws://localhost:3000/ws"); // Adjust URL as needed.
      socket.onopen = () => console.log("WebSocket connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.pagesScraped !== undefined) {
          setProgress(data.pagesScraped);
        }
      };
      socket.onerror = (err) => console.error("WebSocket error:", err);
      setWs(socket);
      return () => {
        socket.close();
      };
    }
  }, [isScraping]);

  // Handler to stop scraping (only for infinite scroll).
  const handleStopScraping = async () => {
    // Send a stop signal to the backend if required.
    setIsScraping(false);
    setError("Scraping stopped by user.");
    if (ws) {
      ws.close();
    }
  };

  // Export scraped data as JSON file.
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(scrapedData, null, 2)], {
      type: "application/json",
    });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "scrapedData.json";
    a.click();
    URL.revokeObjectURL(urlBlob);
  };

  // Handle form submission to start scraping.
  const handleScrape = async (e) => {
    e.preventDefault();

    // Validate URL and required fields.
    if (!isValidLinkedInUrl(url)) {
      setError("Please enter a valid LinkedIn URL.");
      return;
    }
    if (selectedFields.length === 0) {
      setError("Please select at least one field.");
      return;
    }
    if (paginationMethod === "next_button" && (!pagesCount || pagesCount < 1)) {
      setError("Please enter a valid number of pages (minimum 1).");
      return;
    }

    setError(null);
    setIsScraping(true);
    setScrapedData(null);
    setProgress(0);

    const payload = {
      url,
      fields: selectedFields,
      paginationMethod,
      pagesCount: paginationMethod === "next_button" ? pagesCount : undefined,
    };

    try {
      const response = await fetch("http://localhost:3000/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Error fetching scraped data.");
      }
      const data = await response.json();
      setScrapedData(data);
    } catch (err) {
      setError(err.message);
    }
    setIsScraping(false);
    if (ws) {
      ws.close();
    }
  };

  return (
    <div className="app-container">
      <h1>LinkedIn Scraper</h1>
      <form onSubmit={handleScrape} className="scrape-form">
        <div className="form-group">
          <label htmlFor="url">URL:</label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter LinkedIn page URL"
            required
          />
        </div>

        <div className="form-group">
          <label>Select Fields:</label>
          <div className="checkbox-group">
            {predefinedFields.map((field) => (
              <label key={field} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={() => handleFieldToggle(field)}
                />
                {field}
              </label>
            ))}
          </div>
          <div className="button-group">
            <button type="button" onClick={handleSelectAll}>
              Select All
            </button>
            <button type="button" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
          {selectedFields.length > 0 && (
            <div className="selected-chips">
              <strong>Selected Fields:</strong>
              <div className="chips-container">
                {selectedFields.map((field) => (
                  <div key={field} className="chip">
                    {field}
                    <button
                      type="button"
                      onClick={() => handleFieldToggle(field)}
                      className="chip-close"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="pagination">Pagination Method:</label>
          <select
            id="pagination"
            value={paginationMethod}
            onChange={(e) => setPaginationMethod(e.target.value)}
          >
            <option value="next_button">Next Button</option>
            <option value="infinite_scroll">Infinite Scroll</option>
          </select>
        </div>

        {paginationMethod === "next_button" && (
          <div className="form-group">
            <label htmlFor="pagesCount">Number of Pages to Scrape:</label>
            <input
              id="pagesCount"
              type="number"
              min="1"
              value={pagesCount}
              onChange={(e) => setPagesCount(parseInt(e.target.value))}
              required
            />
          </div>
        )}

        {paginationMethod === "infinite_scroll" && isScraping && (
          <div className="form-group">
            <button
              type="button"
              className="stop-button"
              onClick={handleStopScraping}
            >
              Stop Scraping
            </button>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="form-group">
          <button disabled={isScraping} type="submit" className="submit-button">
            {isScraping ? "Scraping..." : "Start Scraping"}
          </button>
        </div>
      </form>

      {isScraping && (
        <div className="progress-indicator">
          <p>Pages scraped: {progress}</p>
        </div>
      )}

      {scrapedData && (
        <div className="output-container">
          <h2>Scraped Data</h2>
          <pre>{JSON.stringify(scrapedData, null, 2)}</pre>
          <button
            type="button"
            className="export-button"
            onClick={handleExport}
          >
            Export JSON
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
