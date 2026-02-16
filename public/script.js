// Sample worst practice SQL queries
const sampleQueries = {
    'select-star': `SELECT * 
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active';`,
    
    'no-where': `SELECT user_id, email, created_at 
FROM users;`,
    
    'function-column': `SELECT * 
FROM orders 
WHERE YEAR(order_date) = 2024 
  AND MONTH(order_date) = 12;`,
    
    'implicit-conversion': `SELECT * 
FROM products 
WHERE product_id = '12345' 
  AND price > '100';`,
    
    'or-conditions': `SELECT * 
FROM customers 
WHERE country = 'USA' 
   OR country = 'Canada' 
   OR country = 'Mexico' 
   OR country = 'Brazil';`,
    
    'subquery-select': `SELECT 
    u.name,
    (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
    (SELECT SUM(amount) FROM orders WHERE user_id = u.id) as total_spent
FROM users u;`,
    
    'not-in': `SELECT * 
FROM products 
WHERE category_id NOT IN (
    SELECT id FROM categories WHERE archived = 1
);`,
    
    'like-wildcard': `SELECT * 
FROM customers 
WHERE email LIKE '%@gmail.com' 
   OR phone LIKE '%555%';`
};

// API URL - adjust if backend runs on different port
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:3000`
    : '';

// UI Controller
class UIController {
    constructor() {
        this.burgerMenu = document.getElementById('burgerMenu');
        this.burgerDropdown = document.getElementById('burgerDropdown');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.sqlInput = document.getElementById('sqlInput');
        this.output = document.getElementById('output');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.burgerMenu.addEventListener('click', () => this.toggleBurgerMenu());
        this.analyzeBtn.addEventListener('click', () => this.analyzeQuery());
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.burger-menu') && !e.target.closest('.burger-dropdown')) {
                this.burgerDropdown.classList.remove('show');
            }
        });

        document.querySelectorAll('.query-option').forEach(option => {
            option.addEventListener('click', () => {
                const queryType = option.dataset.query;
                this.loadSampleQuery(queryType);
            });
        });

        // Keyboard shortcut: Ctrl+Enter to analyze
        this.sqlInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.analyzeQuery();
            }
        });
    }

    toggleBurgerMenu() {
        this.burgerDropdown.classList.toggle('show');
    }

    loadSampleQuery(queryType) {
        const query = sampleQueries[queryType];
        if (query) {
            this.sqlInput.value = query;
            this.burgerDropdown.classList.remove('show');
            // Auto-analyze after loading
            setTimeout(() => this.analyzeQuery(), 100);
        }
    }

    async analyzeQuery() {
        const query = this.sqlInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a SQL query to analyze.');
            return;
        }

        // Show loading state
        this.showLoading();

        try {
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to analyze query');
            }

            const result = await response.json();
            this.displayResult(result);
        } catch (error) {
            this.showError(`Error analyzing query: ${error.message}`);
        }
    }

    showLoading() {
        this.output.innerHTML = `
            <div class="result">
                <div class="issue-card info">
                    <div class="issue-title">⏳ Analyzing your SQL query...</div>
                    <div class="issue-description">Using GitHub Copilot AI to analyze performance and efficiency.</div>
                </div>
            </div>
        `;
    }

    showError(message) {
        this.output.innerHTML = `
            <div class="result">
                <div class="issue-card critical">
                    <div class="issue-title">⚠️ Error</div>
                    <div class="issue-description">${message}</div>
                </div>
            </div>
        `;
    }

    displayResult(result) {
        const scoreClass = result.score >= 80 ? 'good' : result.score >= 50 ? 'medium' : 'poor';
        const scoreLabel = result.score >= 80 ? 'Excellent' : result.score >= 50 ? 'Needs Improvement' : 'Poor';
        
        let issuesHTML = '';
        if (result.issues.length === 0) {
            issuesHTML = `
                <div class="issue-card info">
                    <div class="issue-title">✅ No Issues Found</div>
                    <div class="issue-description">Your query looks good! No major performance issues detected.</div>
                </div>
            `;
        } else {
            issuesHTML = result.issues.map(issue => `
                <div class="issue-card ${issue.severity}">
                    <div class="issue-title">
                        ${issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
                        ${issue.title}
                    </div>
                    <div class="issue-description">${issue.description}</div>
                    <div class="issue-recommendation">
                        <strong>💡 Recommendation:</strong>
                        ${issue.recommendation}
                        ${issue.example ? `<div class="code-block">${issue.example}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        const summaryPoints = result.issues.length === 0 
            ? ['Query follows best practices', 'No performance bottlenecks detected']
            : [
                `${result.issues.filter(i => i.severity === 'critical').length} critical issue(s) found`,
                `${result.issues.filter(i => i.severity === 'warning').length} warning(s) found`,
                `${result.issues.filter(i => i.severity === 'info').length} info item(s)`,
                'Review recommendations above to optimize your query'
            ];

        this.output.innerHTML = `
            <div class="result">
                <div class="score-section ${scoreClass}">
                    <div class="score-label">Efficiency Score</div>
                    <div class="score-value">${result.score}</div>
                    <div class="score-label">${scoreLabel}</div>
                </div>

                <div class="issues-section">
                    <h2>📋 Analysis Results</h2>
                    ${issuesHTML}
                </div>

                <div class="summary-section">
                    <h3>📊 Summary</h3>
                    <ul>
                        ${summaryPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new UIController();
});
