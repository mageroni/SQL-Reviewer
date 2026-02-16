import express from 'express';
import cors from 'cors';
import { CopilotClient } from '@github/copilot-sdk';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Initialize Copilot client
let copilotClient;

async function initializeCopilot() {
    try {
        copilotClient = new CopilotClient();
        await copilotClient.start();
        console.log('✅ Copilot SDK initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Copilot SDK:', error.message);
        console.error('Make sure:');
        console.error('1. GitHub Copilot CLI is installed (npm install -g @githubnext/github-copilot-cli)');
        console.error('2. You are authenticated (run: github-copilot-cli auth)');
        return false;
    }
}

// API endpoint to analyze SQL query
app.post('/api/analyze', async (req, res) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    if (!copilotClient) {
        return res.status(503).json({ 
            error: 'Copilot SDK not initialized',
            message: 'Please ensure GitHub Copilot CLI is installed and authenticated'
        });
    }

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
        const response = await session.sendAndWait({ prompt }, 30000);

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
        copilotReady: !!copilotClient
    });
});

// Start server
async function startServer() {
    const copilotReady = await initializeCopilot();
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        if (!copilotReady) {
            console.log('⚠️  Server started but Copilot SDK is not available');
            console.log('   The app will work with limited functionality');
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
