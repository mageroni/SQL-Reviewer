import express from 'express';
import cors from 'cors';
import { CopilotClient } from '@github/copilot-sdk';

const app = express();
const PORT = process.env.PORT || 3000;
const COPILOT_TIMEOUT = parseInt(process.env.COPILOT_TIMEOUT || '30000', 10); // 30 seconds default

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize Copilot client
let copilotClient;
let useFallback = false;

async function initializeCopilot() {
    try {
        copilotClient = new CopilotClient();
        await copilotClient.start();
        console.log('✅ Copilot SDK initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Copilot SDK:', error.message);
        console.error('⚠️  Falling back to rule-based analyzer');
        console.error('');
        console.error('To use AI-powered analysis:');
        console.error('1. Install GitHub Copilot CLI: npm install -g @githubnext/github-copilot-cli');
        console.error('2. Authenticate: github-copilot-cli auth');
        console.error('3. Restart the server');
        useFallback = true;
        return false;
    }
}

// Fallback analyzer for when Copilot SDK is not available
class FallbackSQLAnalyzer {
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

// API endpoint to analyze SQL query
app.post('/api/analyze', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    // Use fallback analyzer if Copilot SDK is not available
    if (useFallback) {
        try {
            const analyzer = new FallbackSQLAnalyzer(query);
            const result = analyzer.analyze();
            res.json(result);
        } catch (error) {
            console.error('Error in fallback analyzer:', error);
            res.status(500).json({ 
                error: 'Failed to analyze SQL query',
                message: error.message 
            });
        }
        return;
    }

    // Use Copilot SDK for AI-powered analysis
    try {
        // Create a session with Copilot
        const session = await copilotClient.createSession({
            model: 'gpt-4o',
        });

        // Prepare the prompt for SQL analysis
        const prompt = `You are an expert SQL performance analyst. Analyze the following SQL query for efficiency and performance issues.

SQL Query:
\`\`\`sql
${query}
\`\`\`

Provide your analysis in the following JSON format (respond with ONLY valid JSON, no markdown or additional text):

{
  "score": <number between 0-100>,
  "issues": [
    {
      "severity": "<critical|warning|info>",
      "title": "<short title>",
      "description": "<detailed description of the issue>",
      "recommendation": "<how to fix it>",
      "example": "<code example showing the fix>"
    }
  ]
}

Rate the query based on:
- Use of SELECT * (reduce score by 15)
- Missing WHERE clause causing full table scans (reduce score by 20)
- Functions on indexed columns in WHERE (reduce score by 15)
- Implicit type conversions (reduce score by 12)
- Multiple OR conditions (reduce score by 10)
- Subqueries in SELECT clause (reduce score by 18)
- NOT IN with subqueries (reduce score by 12)
- Leading wildcards in LIKE (reduce score by 10)
- Missing JOIN conditions (reduce score by 25)
- Cartesian products (reduce score by 20)

Start with a score of 100 and deduct points for each issue found.`;

        // Send the prompt and wait for response
        const response = await session.sendAndWait({ prompt }, COPILOT_TIMEOUT);

        if (!response || !response.data || !response.data.content) {
            throw new Error('No response from Copilot');
        }

        // Extract JSON from the response
        let content = response.data.content.trim();
        
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Parse the JSON response
        const result = JSON.parse(content);

        // Clean up the session
        await session.destroy();

        res.json(result);
    } catch (error) {
        console.error('Error analyzing SQL:', error);
        res.status(500).json({ 
            error: 'Failed to analyze SQL query',
            message: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        copilotReady: !!copilotClient && !useFallback,
        mode: useFallback ? 'fallback' : 'copilot-sdk'
    });
});

// Start server
async function startServer() {
    const copilotReady = await initializeCopilot();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        if (useFallback) {
            console.log('📊 Running in fallback mode (rule-based analysis)');
        } else {
            console.log('🤖 Running with GitHub Copilot SDK (AI-powered analysis)');
        }
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (copilotClient) {
        await copilotClient.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (copilotClient) {
        await copilotClient.stop();
    }
    process.exit(0);
});

startServer();
