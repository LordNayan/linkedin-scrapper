import React, { useState, useEffect } from "react";
import "./App.css";

const predefinedFields = ["Name", "Profile", "Photo", "Headline", "Location"];

const App = () => {
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

  // Validate that the URL is a proper LinkedIn URL.
  const isValidLinkedInUrl = (link) => {
    const regex = /^https:\/\/(www\.)?linkedin\.com\/.+/;
    return regex.test(link);
  };

  // Toggle field selection.
  const handleFieldToggle = (field) => {
    setSelectedFields((prevSelected) =>
      prevSelected.includes(field)
        ? prevSelected.filter((f) => f !== field)
        : [...prevSelected, field]
    );
  };

  const handleSelectAll = () => setSelectedFields(predefinedFields);
  const handleClearAll = () => setSelectedFields([]);

  // Establish a WebSocket connection for real-time progress updates.
  useEffect(() => {
    if (!isScraping) return;

    const socket = new WebSocket("ws://localhost:4000");
    socket.onopen = () => console.log("WebSocket connected");

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stopScraping) {
          setIsScraping(false);
          socket.close();
        } else if (
          data.pagesScraped !== undefined &&
          data.pageData !== undefined
        ) {
          setProgress(data.pagesScraped);
          setTableData((prevData) => [...prevData, ...data.pageData]);
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
  }, [isScraping]);

  // Handler to stop the scraping process.
  const handleStopScraping = () => {
    setIsScraping(false);
    setError("Scraping stopped by user.");
    if (ws) ws.close();
  };

  // Handler to export scraped data as JSON.
  const handleExport = () => {
    const json = JSON.stringify(tableData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "scrapedData.json";
    a.click();
    URL.revokeObjectURL(urlBlob);
  };

  // Handler to initiate scraping.
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

    // Reset state before scraping.
    setError(null);
    setIsScraping(true);
    setProgress(0);
    setTableData([]);
    setCurrentPage(1);

    const payload = {
      url,
      fields: selectedFields,
      paginationMethod,
      pagesCount: paginationMethod === "next_button" ? pagesCount : undefined,
    };

    try {
      const response = await fetch("http://localhost:3001/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Error starting scraping.");
      }
      // Final data is received via WebSocket updates.
    } catch (err) {
      setError(err.message);
      setIsScraping(false);
      if (ws) ws.close();
    }
  };

  // Render table with pagination.
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
                setPagesCount(value === "" ? "" : parseInt(value, 10));
              }}
              onBlur={(e) => {
                if (e.target.value === "" || parseInt(e.target.value, 10) < 1) {
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

      {isScraping && (
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
};

export default App;
