
import { useEffect, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [stats, setStats] = useState({
    total_reviews: 0,
    total_issues: 0,
    average_score: 0,
  });
  const [statsError, setStatsError] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        const response = await fetch(`${API_URL}/stats`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Statistics API error: ${response.status}`);
        }
        const data = await response.json();
        setStats(data);
        setStatsError("");
      } catch (err) {
        if (err.name !== "AbortError") {
          setStatsError(err.message || "Could not load statistics.");
        }
      }
    }

    loadStats();
    return () => controller.abort();
  }, []);

  async function refreshStats() {
    try {
      const response = await fetch(`${API_URL}/stats`);
      if (!response.ok) {
        throw new Error(`Statistics API error: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
      setStatsError("");
    } catch (err) {
      setStatsError(err.message || "Could not refresh statistics.");
    }
  }

  async function handleReview() {
    if (!code.trim() || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, language }),
      });

      if (!response.ok) {
        let message = `API error: ${response.status}`;

        try {
          const errorData = await response.json();
          if (typeof errorData.detail === "string") {
            message = errorData.detail;
          }
        } catch {
          // Use the HTTP error if the response is not JSON.
        }

        throw new Error(message);
      }

      const data = await response.json();
      setResult(data);
      await refreshStats();
    } catch (err) {
      setError(err.message || "Unable to review code.");
    } finally {
      setLoading(false);
    }
  }

  function clearEditor() {
    setCode("");
    setResult(null);
    setError("");
  }

  async function copyCode(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Could not copy code to clipboard.");
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">◆</span>
          <span>CodeGuard AI</span>
        </div>

        <nav className="navigation">
          <div className="nav-item active">⌘ Dashboard</div>
          <div className="nav-item">⌁ Code Review</div>
          <div className="nav-item">◷ Review History</div>
          <div className="nav-item">⚙ Settings</div>
        </nav>

        <div className="sidebar-bottom">
          AI-Powered Developer Tools
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <h1>Code Review Dashboard</h1>
            <p>Analyze code and improve software quality.</p>
          </div>

          <span className="status">
            ● Local AI Mode
          </span>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span>Total Reviews</span>
            <strong>{stats.total_reviews}</strong>
          </div>

          <div className="stat-card">
            <span>Issues Found</span>
            <strong>{stats.total_issues}</strong>
          </div>

          <div className="stat-card">
            <span>Average Quality Score</span>
            <strong>{stats.average_score}/100</strong>
          </div>

          <div className="stat-card">
            <span>Current Language</span>
            <strong>
              {language === "python" ? "Python" : "JavaScript"}
            </strong>
          </div>
        </section>

        {statsError && (
          <div className="error-message" role="alert">
            Statistics unavailable: {statsError}
          </div>
        )}

        <section className="review-grid">
          {/* SOURCE CODE PANEL */}
          <div className="panel">
            <div className="panel-heading">
              <h2>Source Code</h2>

              <button
                type="button"
                className="clear-button"
                onClick={clearEditor}
              >
                Clear
              </button>
            </div>

            <label htmlFor="language">
              Programming Language
            </label>

            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>

            <label htmlFor="code">Code Editor</label>

            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your source code here..."
              spellCheck={false}
            />

            <div className="editor-footer">
              <span>{code.length} characters</span>

              <button
                type="button"
                className="review-button"
                onClick={handleReview}
                disabled={loading || !code.trim()}
              >
                {loading
                  ? "Analyzing Code..."
                  : "✦ Review Code"}
              </button>
            </div>
          </div>

          {/* AI REVIEW RESULTS PANEL */}
          <div className="panel">
            <div className="panel-heading">
              <h2>Review Results</h2>
              <span className="panel-tag">
                Qwen2.5-Coder 7B
              </span>
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {loading && (
              <div className="empty-state" role="status">
                <div className="empty-icon">✦</div>
                <h3>Analyzing your code...</h3>
                <p>
                  Ollama is reviewing your code locally.
                  This may take a little time.
                </p>
              </div>
            )}

            {!loading && result && (
              <div className="review-output">
                <div className="success-message">
                  ✓ AI code review completed
                </div>

                <div className="review-results">
                  {/* QUALITY SCORE */}
                  <div className="quality-card">
                    <h3>Code Quality Score</h3>

                    <div className="quality-score">
                      {result.quality_score ?? "N/A"}
                      <span>/100</span>
                    </div>

                    <p>{result.summary}</p>
                  </div>

                  {/* DETECTED ISSUES */}
                  <h3>
                    Detected Issues (
                    {result.findings?.length ?? 0})
                  </h3>

                  {(!result.findings ||
                    result.findings.length === 0) && (
                    <p>
                      No issues detected by the AI reviewer.
                    </p>
                  )}

                  {result.findings?.map(
                    (finding, index) => (
                      <div
                        className="finding-card"
                        key={index}
                      >
                        <div className="finding-header">
                          <h4>{finding.title}</h4>

                          <span
                            className={`severity ${
                              finding.severity || "low"
                            }`}
                          >
                            {finding.severity}
                          </span>
                        </div>

                        <p>
                          <strong>Category:</strong>{" "}
                          {finding.category}
                        </p>

                        <p>
                          <strong>Line:</strong>{" "}
                          {finding.line ?? "N/A"}
                        </p>

                        <p>{finding.explanation}</p>

                        <h5>Suggested Fix</h5>
                        <p>{finding.suggestion}</p>

                        {finding.fixed_code && (
                          <>
                            <pre className="code-fix">
                              <code>
                                {finding.fixed_code}
                              </code>
                            </pre>

                            <button
                              type="button"
                              className="clear-button"
                              onClick={() =>
                                copyCode(
                                  finding.fixed_code
                                )
                              }
                            >
                              Copy Fix
                            </button>
                          </>
                        )}
                      </div>
                    )
                  )}

                  {/* IMPROVED CODE */}
                  {result.improved_code && (
                    <div className="improved-code-card">
                      <div className="finding-header">
                        <h3>Improved Code</h3>

                        <button
                          type="button"
                          className="clear-button"
                          onClick={() =>
                            copyCode(
                              result.improved_code
                            )
                          }
                        >
                          Copy Code
                        </button>
                      </div>

                      <pre className="code-fix">
                        <code>
                          {result.improved_code}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loading && !result && !error && (
              <div className="empty-state">
                <div className="empty-icon">✦</div>

                <h3>No Review Yet</h3>

                <p>
                  Paste your code and click Review Code
                  to see AI-generated analysis results.
                </p>
              </div>
            )}
          </div>
        </section>

        <footer>
          CodeGuard AI · React + FastAPI + Ollama
        </footer>
      </div>
    </div>
  );
}

export default App;
