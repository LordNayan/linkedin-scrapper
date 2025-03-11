import React, { useState } from 'react';
import './App.css';

const predefinedFields = ["Name", "Profile", "Photo", "Headline", "Company", "Location"];

function App() {
  const [url, setUrl] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [paginationMethod, setPaginationMethod] = useState('next_button');
  const [scrapedData, setScrapedData] = useState(null);
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState(null);

  // Toggle a field selection.
  const handleFieldToggle = (field) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  // Select all fields.
  const handleSelectAll = () => {
    setSelectedFields(predefinedFields);
  };

  // Clear all fields.
  const handleClearAll = () => {
    setSelectedFields([]);
  };

  // Handle form submission to initiate scraping.
  const handleScrape = async (e) => {
    e.preventDefault();

    // Validate that at least one field is selected.
    if (selectedFields.length === 0) {
      setError("Please select at least one field.");
      return;
    }
    setError(null);
    setIsScraping(true);
    setScrapedData(null);

    const payload = {
      url,
      fields: selectedFields, // Only field names are sent.
      paginationMethod,
    };

    try {
      // Replace '/api/scrape' with your actual backend endpoint.
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error fetching scraped data.');
      }
      const data = await response.json();
      setScrapedData(data);
    } catch (err) {
      setError(err.message);
    }
    setIsScraping(false);
  };

  return (
    <div className="app-container">
      <h1>LinkedIn Scraper</h1>
      <form onSubmit={handleScrape}>
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
            {predefinedFields.map(field => (
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
            <button type="button" onClick={handleSelectAll}>Select All</button>
            <button type="button" onClick={handleClearAll}>Clear All</button>
          </div>
          {selectedFields.length > 0 && (
            <div className="selected-chips">
              <strong>Selected Fields:</strong>
              <div className="chips-container">
                {selectedFields.map(field => (
                  <div key={field} className="chip">
                    {field}
                    <button type="button" onClick={() => handleFieldToggle(field)} className="chip-close">
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

        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="submit-button">
          {isScraping ? 'Scraping...' : 'Start Scraping'}
        </button>
      </form>

      {scrapedData && (
        <div className="output-container">
          <h2>Scraped Data</h2>
          <pre>{JSON.stringify(scrapedData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
