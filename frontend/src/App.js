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
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [ws, setWs] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [isScraping, setIsScraping] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Validate URL is a proper LinkedIn URL.
  const isValidLinkedInUrl = (link) => {
    const regex = /^https:\/\/(www\.)?linkedin\.com\/.+/;
    return regex.test(link);
  };

  const handleFieldToggle = (field) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleSelectAll = () => setSelectedFields(predefinedFields);
  const handleClearAll = () => setSelectedFields([]);

  // Establish a WebSocket connection for real-time progress updates.
  useEffect(() => {
    if (isScraping) {
      const socket = new WebSocket("ws://localhost:4000"); // Adjust URL as needed.
      socket.onopen = () => console.log("WebSocket connected");
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.stopScraping) {
            setIsScraping(false);
            if (ws) ws.close();
          }
          // Expecting { pagesScraped: number, pageData: [...] }
          else if (
            data.pagesScraped !== undefined &&
            data.pageData !== undefined
          ) {
            setProgress(data.pagesScraped);
            // Append new data from this page.
            setTableData((prev) => [...prev, ...data.pageData]);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message", err);
        }
      };
      socket.onerror = (err) => console.error("WebSocket error:", err);
      setWs(socket);
      return () => {
        socket.close();
      };
    }
  }, [isScraping]);

  const handleStopScraping = () => {
    setIsScraping(false);
    setError("Scraping stopped by user.");
    if (ws) ws.close();
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(tableData, null, 2)], {
      type: "application/json",
    });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "scrapedData.json";
    a.click();
    URL.revokeObjectURL(urlBlob);
  };

  const handleScrape = async (e) => {
    e.preventDefault();

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
    setProgress(0);
    setTableData([]); // Reset table data for a new scrape.

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
        throw new Error("Error starting scraping.");
      }
      // Final data is expected via WebSocket updates.
    } catch (err) {
      setError(err.message);
      setIsScraping(false);
      if (ws) ws.close();
    }
  };

  // Render dynamic table from tableData.
  const renderTable = () => {
    if (tableData.length === 0) return null;
    const headers = Object.keys(tableData[0]);
    const totalPages = Math.ceil(tableData.length / rowsPerPage);
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = tableData.slice(indexOfFirstRow, indexOfLastRow);

    return (
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, idx) => (
              <tr key={idx}>
                {headers.map((header, hIdx) => (
                  <td key={hIdx}>{row[header]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination-controls">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    );
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
            className="styled-select"
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
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  // Allow empty input while typing
                  setPagesCount("");
                } else {
                  setPagesCount(parseInt(value));
                }
              }}
              onBlur={(e) => {
                if (e.target.value === "" || parseInt(e.target.value) < 1) {
                  setPagesCount(1);
                }
              }}
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

      {!progress && (
        <div className="progress-indicator">
          <p>Pages scraped: {progress}</p>
        </div>
      )}

      {tableData.length > 0 && (
        <div className="table-container">
          <h2>Scraped Data</h2>
          {renderTable()}
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
