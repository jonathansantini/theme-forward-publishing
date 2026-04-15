# Smart Content Scheduler

A Shopify app that allows merchants to schedule the visibility of theme content (sections and blocks) at specific times with recurring schedule support. The app uses a **Theme App Extension** and **App Proxy** to dynamically show/hide content without modifying theme files directly.

## Features

- **Smart Content Scheduling**: Schedule content (sections and blocks) to show/hide at specific dates/times
- **Recurring Schedules**: Support for daily, weekly, and monthly recurring patterns
- **Timezone Support**: All schedules use the store's configured timezone
- **Template Support**: Works with all Online Store 2.0 template types (homepage, product, collection, etc.)
- **Schedule Management**: Finalize schedules to lock them, unpublish to modify
- **Backup System**: Automatic backups before every theme modification
- **Audit Trail**: Complete execution history and logs

## Architecture

### Stack

- **Backend**: Node.js with Express
- **Database**: Shopify Metafields (MVP) - migration path to PostgreSQL documented
- **API**: Shopify GraphQL Admin API (2025-01)
- **Frontend**: React with Shopify Polaris components
- **App Bridge**: Shopify App Bridge for embedded app experience
- **Scheduling**: Node-cron for background job processing

### Project Structure

```
smart-content-scheduler/
├── web/
│   ├── backend/
│   │   ├── server.js              # Express server
│   │   ├── routes/                # API routes
│   │   ├── services/              # Business logic
│   │   ├── jobs/                  # Cron jobs
│   │   ├── utils/                 # Utilities
│   │   └── middleware/            # Express middleware
│   └── frontend/
│       ├── App.jsx                # Main app component
│       ├── pages/                 # Page components
│       ├── components/            # Reusable components
│       └── hooks/                 # Custom React hooks
├── shopify.app.toml               # Shopify app config
├── package.json
├── .env.example
└── docs/                          # Documentation
```

## Setup Instructions

### Prerequisites

- Node.js 18.x or higher
- Shopify Partner account
- Shopify development store
- ngrok or similar tunneling service (for local development)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd smart-content-scheduler
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
SCOPES=write_themes,read_themes,write_content,read_content
NODE_ENV=development
PORT=3000
```

4. **Create app in Shopify Partner Dashboard**

- Go to [Shopify Partners](https://partners.shopify.com)
- Create a new app
- Set App URL to your ngrok URL
- Set Redirect URLs to:
  - `https://your-ngrok-url.ngrok.io/auth/callback`
  - `https://your-ngrok-url.ngrok.io/auth/shopify/callback`
- Enable required scopes: `write_themes`, `read_themes`, `write_content`, `read_content`
- **Configure App Proxy** (Required):
  - Subpath prefix: `apps`
  - Subpath: `scheduler`
  - Proxy URL: `https://your-ngrok-url.ngrok.io/proxy`
  - See [APP_PROXY_SETUP.md](./APP_PROXY_SETUP.md) for detailed instructions

5. **Start development server**

```bash
npm run dev
```

This starts both the backend (port 3000) and frontend (port 5173) in development mode.

6. **Install app on development store**

- Navigate to your app URL in the Partner Dashboard
- Click "Test on development store"
- Select your development store and install

## Usage

### Creating a Schedule

1. Click "Create Schedule" from the dashboard
2. Select a template from your published theme
3. Choose a section from the template
4. Configure schedule details:
   - **Action**: Show or Hide
   - **Execution Time**: When the change should occur
   - **Recurring** (optional): Set daily/weekly/monthly recurrence
5. Click "Create Schedule"

### Managing Schedules

- **Edit**: Click on any pending schedule to modify it
- **Finalize**: Lock a schedule to prevent accidental changes
- **Unpublish**: Unlock a finalized schedule to edit
- **Delete**: Remove a schedule (only if not finalized)

### Schedule States

- **Pending**: Waiting to be executed
- **Active**: Currently being processed
- **Completed**: Successfully executed (one-time schedules only)
- **Failed**: Execution failed (will auto-retry up to 3 times)

## How It Works

### Section Visibility Control (App Proxy Method)

1. **Schedule Execution**: Background job checks for pending schedules every minute
2. **Update Metafield**: When a schedule triggers, update the `hidden_sections` metafield
3. **App Proxy Request**: Theme app block loads script from `/apps/scheduler/visibility.js`
4. **Backend Response**: App proxy endpoint reads metafield and returns JavaScript/CSS
5. **DOM Manipulation**: JavaScript removes hidden sections from DOM before they render
6. **Audit Log**: Record execution in metafield storage

**Key Benefits:**
- ✅ No theme file modifications (safer, Shopify-recommended approach)
- ✅ Sections removed from DOM entirely (JavaScript mode) or hidden with CSS
- ✅ Works within Shopify's official APIs and guidelines
- ✅ No special API exemptions required

### Recurring Schedule Logic

For recurring schedules, the system:

1. Executes the scheduled action at the specified time
2. Calculates the next occurrence based on recurrence type
3. Updates the schedule with new execution time
4. Continues until manually disabled

### Backup & Restore

- Backups created before every modification
- Last 10 backups kept per template
- One-click restore from dashboard (future feature)
- Original section data stored for "show" actions

## API Endpoints

### Schedules

- `GET /api/schedules` - List all schedules
- `GET /api/schedules/:id` - Get specific schedule
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/:id/finalize` - Finalize schedule
- `POST /api/schedules/:id/unpublish` - Unpublish schedule

### Themes

- `GET /api/themes/published` - Get published theme
- `GET /api/themes/:themeId/templates` - List templates
- `GET /api/themes/:themeId/templates/:templateName/sections` - Get sections
- `POST /api/themes/:themeId/validate-section` - Validate section exists

### App Proxy (Public Endpoints)

- `GET /proxy/visibility.js?mode=js` - Returns JavaScript to remove hidden sections
- `GET /proxy/visibility.js?mode=css` - Returns CSS to hide sections
- `GET /proxy/health` - Proxy health check

### System

- `GET /health` - Health check
- `GET /api/shop` - Shop info (including timezone)
- `POST /api/processor/trigger` - Manually trigger schedule processor (testing)

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

### Code Structure

- **Services**: Core business logic (GraphQL, scheduling, theme modification)
- **Routes**: Express API endpoints
- **Jobs**: Background cron jobs
- **Utils**: Shared utilities (timezone, validation)
- **Components**: React UI components
- **Hooks**: Custom React hooks for data fetching

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Heroku deployment instructions.

## Documentation

- **[APP_PROXY_SETUP.md](./APP_PROXY_SETUP.md)** - **Required:** App proxy configuration guide
- [METAFIELD_SCHEMA.md](./METAFIELD_SCHEMA.md) - Metafield structure and migration guide
- [API_REFERENCE.md](./API_REFERENCE.md) - GraphQL queries and mutations
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment instructions
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions

## Security Features

- **Rate Limit Handling**: Automatic backoff when approaching Shopify API limits
- **Error Recovery**: Retry failed schedules with exponential backoff
- **Validation**: Comprehensive input validation
- **Backups**: Automatic backups before every change
- **Audit Trail**: Complete execution logs

## Limitations (MVP)

- Section-level scheduling only (block-level coming in Phase 2)
- Metafield storage (PostgreSQL migration planned)
- Single shop per deployment
- Manual backup restoration
- Basic UI (calendar view coming in Phase 2)

## Future Enhancements

- Block-level scheduling
- PostgreSQL database
- Calendar view
- Schedule templates
- Bulk operations
- Multi-store support
- Analytics dashboard
- Email notifications

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Email: support@example.com
