# SQL-Reviewer

A web application that analyzes SQL queries for efficiency and performance issues using GitHub Copilot SDK.

## Features

- **Split-pane interface** inspired by jsonschemavalidator.net
- **AI-powered analysis** using GitHub Copilot SDK
- **Real-time feedback** on query efficiency with scoring (0-100)
- **Detailed recommendations** for improving SQL performance
- **Pre-baked worst practice queries** accessible via burger menu
- **Beautiful UI** with color-coded severity levels

## Prerequisites

1. **Node.js** (v18 or higher)
2. **GitHub Copilot CLI** - Install with:
   ```bash
   npm install -g @github/copilot
   ```
3. **GitHub Copilot subscription** - Required for using the Copilot SDK

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MG-Octodemo/SQL-Reviewer.git
   cd SQL-Reviewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Authenticate with GitHub CLI:
   ```bash
   gh auth login
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Enter a SQL query in the left pane or use the burger menu (☰) to select a pre-baked worst practice query

4. Click "Analyze Query" to get AI-powered efficiency analysis

## Configuration

You can configure the application using environment variables:

- `PORT` - Server port (default: 3000)
- `COPILOT_TIMEOUT` - Timeout for Copilot SDK analysis in milliseconds (default: 30000)

## How It Works

The application uses the GitHub Copilot SDK to analyze SQL queries for common performance issues:

- SELECT * usage
- Missing WHERE clauses (full table scans)
- Functions on indexed columns
- Implicit type conversions
- Multiple OR conditions
- Subqueries in SELECT clause
- NOT IN with subqueries
- Leading wildcards in LIKE patterns
- Missing JOIN conditions
- Cartesian products

Each query receives a score from 0-100, with detailed explanations and recommendations for improvement.

## Architecture

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js + Express
- **AI Engine**: GitHub Copilot SDK (GPT-4o)
- **Communication**: REST API

## Development

For development with auto-restart on file changes:
```bash
npm run dev
```

## API Endpoints

- `POST /api/analyze` - Analyze a SQL query
  ```json
  {
    "query": "SELECT * FROM users"
  }
  ```

- `GET /api/health` - Check server health

## License

MIT

