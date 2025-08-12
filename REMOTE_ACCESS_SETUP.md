# Setup Guide for Remote Access

## Your code is now ready for remote access! Here's how to set it up:

### Step 1: Install ngrok
1. Go to https://ngrok.com/ and create a free account
2. Download ngrok for Windows
3. Extract it to a folder (e.g., C:\ngrok\)
4. Open PowerShell and navigate to that folder

### Step 2: Start your server
```bash
# In your project directory, start the server
node server/server.js
```

### Step 3: Create ngrok tunnel
```bash
# In another PowerShell window, run:
ngrok http 8080
```

You'll see output like:
```
Session Status    online
Account           your-email@gmail.com
Forwarding        https://abc123.ngrok.io -> http://localhost:8080
```

### Step 4: Update the config
1. Copy the https URL (e.g., `https://abc123.ngrok.io`)
2. Edit `config.js` and replace `'https://your-ngrok-url.ngrok.io'` with your actual URL
3. Save the file

### Step 5: Deploy to GitHub Pages
1. Commit and push all your changes to GitHub
2. Your site will be available at https://axom007.github.io/innsync-hotel-management/

### How it works:
- **Local access**: Uses `http://localhost:8080`
- **Remote access via GitHub Pages**: Automatically uses your ngrok URL
- **No code changes needed**: Environment is detected automatically

### Testing:
1. Open locally: `file:///path/to/index.html` → Uses localhost
2. Open on GitHub Pages: `https://axom007.github.io/...` → Uses ngrok
3. Both will work seamlessly!

### Troubleshooting:
- If API calls fail, check that ngrok is running
- Enable debug mode by setting `DEBUG: true` in config.js to see what URL is being used
- ngrok URLs change each time you restart (unless you have a paid plan)
