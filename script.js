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

// SQL Analyzer class
class SQLAnalyzer {
    constructor(query) {
        this.query = query.toLowerCase();
        this.originalQuery = query;
        this.issues = [];
        this.score = 100;
    }

    analyze() {
        this.checkSelectStar();
        this.checkMissingWhere();
        this.checkFunctionOnColumn();
        this.checkImplicitConversion();
        this.checkOrConditions();
        this.checkSubqueryInSelect();
        this.checkNotIn();
        this.checkLeadingWildcard();
        this.checkMissingIndexHints();
        this.checkCartesianJoin();
        
        return {
            score: Math.max(0, this.score),
            issues: this.issues
        };
    }

    checkSelectStar() {
        if (this.query.includes('select *')) {
            this.score -= 15;
            this.issues.push({
                severity: 'warning',
                title: 'SELECT * Usage Detected',
                description: 'Using SELECT * retrieves all columns from the table, including columns you might not need. This increases network traffic, memory usage, and processing time.',
                recommendation: 'Specify only the columns you need in your query.',
                example: 'Instead of: SELECT * FROM users\nUse: SELECT id, name, email FROM users'
            });
        }
    }

    checkMissingWhere() {
        const hasWhere = this.query.includes('where');
        const hasJoin = this.query.includes('join');
        const hasSelect = this.query.includes('select');
        const hasFrom = this.query.includes('from');
        
        if (hasSelect && hasFrom && !hasWhere && !hasJoin) {
            this.score -= 20;
            this.issues.push({
                severity: 'critical',
                title: 'Missing WHERE Clause - Full Table Scan',
                description: 'Your query lacks a WHERE clause, which means it will perform a full table scan. This can be extremely slow on large tables and puts unnecessary load on the database.',
                recommendation: 'Add a WHERE clause to filter the results and reduce the amount of data processed.',
                example: 'Add: WHERE status = \'active\' AND created_at >= \'2024-01-01\''
            });
        }
    }

    checkFunctionOnColumn() {
        const functionPatterns = [
            /where\s+\w*\s*(year|month|day|upper|lower|substring|trim|concat)\s*\(/,
            /and\s+\w*\s*(year|month|day|upper|lower|substring|trim|concat)\s*\(/,
            /or\s+\w*\s*(year|month|day|upper|lower|substring|trim|concat)\s*\(/
        ];
        
        for (let pattern of functionPatterns) {
            if (pattern.test(this.query)) {
                this.score -= 15;
                this.issues.push({
                    severity: 'critical',
                    title: 'Function Applied to Indexed Column',
                    description: 'Applying functions to columns in the WHERE clause prevents the database from using indexes efficiently. The database must evaluate the function for every row.',
                    recommendation: 'Restructure your query to avoid functions on columns, or create function-based indexes.',
                    example: 'Instead of: WHERE YEAR(order_date) = 2024\nUse: WHERE order_date >= \'2024-01-01\' AND order_date < \'2025-01-01\''
                });
                break;
            }
        }
    }

    checkImplicitConversion() {
        const stringNumberPattern = /where\s+\w+\s*=\s*['"][0-9]+['"]/;
        if (stringNumberPattern.test(this.query)) {
            this.score -= 12;
            this.issues.push({
                severity: 'warning',
                title: 'Implicit Type Conversion Detected',
                description: 'Comparing a numeric column with a string value forces the database to perform type conversion on every row, which prevents index usage and degrades performance.',
                recommendation: 'Use the correct data type in your comparisons. Remove quotes from numeric values.',
                example: 'Instead of: WHERE id = \'123\'\nUse: WHERE id = 123'
            });
        }
    }

    checkOrConditions() {
        const orCount = (this.query.match(/\bor\b/g) || []).length;
        if (orCount >= 3) {
            this.score -= 10;
            this.issues.push({
                severity: 'warning',
                title: 'Multiple OR Conditions',
                description: `Your query contains ${orCount} OR conditions. Multiple OR conditions can make it difficult for the query optimizer to choose efficient execution plans and may prevent index usage.`,
                recommendation: 'Consider using IN clause or UNION for better performance.',
                example: 'Instead of: WHERE country = \'USA\' OR country = \'Canada\' OR country = \'Mexico\'\nUse: WHERE country IN (\'USA\', \'Canada\', \'Mexico\')'
            });
        }
    }

    checkSubqueryInSelect() {
        const selectClause = this.query.match(/select\s+(.*?)\s+from/s);
        if (selectClause && selectClause[1].includes('select')) {
            this.score -= 18;
            this.issues.push({
                severity: 'critical',
                title: 'Subquery in SELECT Clause',
                description: 'Subqueries in the SELECT clause are executed once for each row in the result set. This can lead to N+1 query problems and severe performance degradation.',
                recommendation: 'Use JOINs or window functions instead of subqueries in SELECT.',
                example: 'Instead of: SELECT name, (SELECT COUNT(*) FROM orders WHERE user_id = u.id)\nUse: SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id'
            });
        }
    }

    checkNotIn() {
        if (this.query.includes('not in')) {
            this.score -= 12;
            this.issues.push({
                severity: 'warning',
                title: 'NOT IN with Subquery',
                description: 'NOT IN can be inefficient and behaves unexpectedly with NULL values. If the subquery returns any NULL, the entire NOT IN condition returns no results.',
                recommendation: 'Use NOT EXISTS or LEFT JOIN with IS NULL instead.',
                example: 'Instead of: WHERE id NOT IN (SELECT...)\nUse: WHERE NOT EXISTS (SELECT 1 FROM... WHERE...)'
            });
        }
    }

    checkLeadingWildcard() {
        if (this.query.includes('like \'%') || this.query.includes('like "%')) {
            this.score -= 10;
            this.issues.push({
                severity: 'info',
                title: 'Leading Wildcard in LIKE',
                description: 'LIKE patterns that start with a wildcard (%) cannot use indexes efficiently. The database must scan all rows to find matches.',
                recommendation: 'If possible, avoid leading wildcards or consider using full-text search for better performance.',
                example: 'Better: WHERE email LIKE \'john%\'\nAvoid: WHERE email LIKE \'%@gmail.com\''
            });
        }
    }

    checkMissingIndexHints() {
        if (this.query.includes('join') && !this.query.includes('on')) {
            this.score -= 25;
            this.issues.push({
                severity: 'critical',
                title: 'Missing JOIN Condition',
                description: 'JOIN without ON condition creates a Cartesian product, multiplying rows from both tables.',
                recommendation: 'Always specify JOIN conditions using ON clause.',
                example: 'Use: JOIN orders o ON u.id = o.user_id'
            });
        }
    }

    checkCartesianJoin() {
        const fromMatch = this.query.match(/from\s+(\w+\s*,\s*\w+)/);
        if (fromMatch && !this.query.includes('where')) {
            this.score -= 20;
            this.issues.push({
                severity: 'critical',
                title: 'Potential Cartesian Product',
                description: 'Multiple tables in FROM clause without proper WHERE conditions can result in a Cartesian product, causing exponential growth in result set.',
                recommendation: 'Use explicit JOIN syntax with proper ON conditions.',
                example: 'Instead of: FROM users, orders WHERE users.id = orders.user_id\nUse: FROM users JOIN orders ON users.id = orders.user_id'
            });
        }
    }
}

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

    analyzeQuery() {
        const query = this.sqlInput.value.trim();
        
        if (!query) {
            this.showError('Please enter a SQL query to analyze.');
            return;
        }

        const analyzer = new SQLAnalyzer(query);
        const result = analyzer.analyze();
        
        this.displayResult(result);
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
