# SecureChat - Deployment Guide

This guide will help you deploy SecureChat to the internet so anyone can access it.

## Quick Deploy Options

### Option 1: Railway (Recommended - Easiest)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Railway will auto-detect Node.js and deploy

3. **Configure Environment Variables** (if needed)
   - Go to your project → Variables
   - Add `BASE_URL` = `https://your-app-name.railway.app` (Railway provides this)
   - Add `PORT` = `3000` (Railway sets this automatically)

4. **Access Your App**
   - Railway provides a public URL like `https://your-app-name.railway.app`
   - Share this URL - anyone can now access your chat!

---

### Option 2: Render

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up for free

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the repository and branch

3. **Configure**
   - **Name**: securechat (or any name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free tier is fine

4. **Environment Variables**
   - Add `BASE_URL` = `https://your-app-name.onrender.com`
   - Render sets `PORT` automatically

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your app will be available at the provided URL

---

### Option 3: Heroku

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create securechat-yourname
   ```

3. **Set Environment Variable**
   ```bash
   heroku config:set BASE_URL=https://securechat-yourname.herokuapp.com
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Open App**
   ```bash
   heroku open
   ```

---

### Option 4: DigitalOcean App Platform

1. **Create Account**
   - Go to [digitalocean.com](https://www.digitalocean.com)

2. **Create App**
   - Go to "Apps" → "Create App"
   - Connect your GitHub repository
   - Select repository and branch

3. **Configure**
   - **Type**: Web Service
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **Environment Variables**: Add `BASE_URL` = your app URL

4. **Deploy**
   - Click "Create Resources"
   - Your app will be deployed with a public URL

---

### Option 5: Your Own VPS/Server

If you have your own server (VPS, cloud instance, etc.):

1. **Install Dependencies**
   ```bash
   # On your server
   git clone your-repo-url
   cd SecureChat
   npm install
   ```

2. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   ```

3. **Set Environment Variables**
   ```bash
   export BASE_URL=https://yourdomain.com
   export PORT=3000
   ```

4. **Start with PM2**
   ```bash
   pm2 start server.js --name securechat
   pm2 save
   pm2 startup  # Follow instructions to auto-start on reboot
   ```

5. **Configure Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /socket.io/ {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

6. **Set up SSL (Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Environment Variables

For all deployment methods, you can set these environment variables:

- `PORT`: Port number (usually auto-set by hosting provider)
- `BASE_URL`: Your public URL (e.g., `https://securechat.railway.app`)
  - Important: Use `https://` and include the full domain
  - This ensures generated links work correctly

---

## Testing Your Deployment

1. **Access your deployed URL**
2. **Create a new chat**
3. **Copy the generated link**
4. **Open the link in an incognito/private window** (simulates a different user)
5. **Send messages between the two windows**
6. **Verify encryption is working**

---

## Important Notes

### Security Considerations

1. **CORS Configuration**: The current setup allows all origins (`origin: "*"`). For production:
   ```javascript
   cors: {
     origin: "https://yourdomain.com", // Restrict to your domain
     methods: ["GET", "POST"]
   }
   ```

2. **HTTPS**: Always use HTTPS in production. Most hosting providers provide SSL certificates automatically.

3. **Rate Limiting**: Consider adding rate limiting for production use to prevent abuse.

### Limitations

- **Free Tier Limits**: Free hosting tiers may have:
  - Limited uptime (apps may sleep after inactivity)
  - Resource limits (RAM, CPU)
  - Bandwidth restrictions

- **Persistence**: Session data is stored in memory. If the server restarts, all active sessions are lost.

---

## Troubleshooting

### Links Show Localhost

- **Problem**: Generated links still show `localhost:3000`
- **Solution**: Set the `BASE_URL` environment variable to your public URL

### WebSocket Connection Fails

- **Problem**: Messages not sending, WebSocket errors
- **Solution**: 
  - Ensure your hosting provider supports WebSockets
  - Check reverse proxy configuration (if using Nginx)
  - Verify CORS settings

### App Not Starting

- **Problem**: Deployment fails or app crashes
- **Solution**:
  - Check logs: `heroku logs --tail` or hosting provider's log viewer
  - Verify `package.json` has correct start script
  - Ensure Node.js version is compatible (v14+)

---

## Quick Reference

**Railway**: Easiest, auto-detects everything, free tier available  
**Render**: Simple, good free tier, auto-SSL  
**Heroku**: Well-established, requires CLI  
**DigitalOcean**: More control, costs money  
**VPS**: Full control, requires server management

Choose based on your needs:
- **Just want it working fast**: Railway or Render
- **Need more control**: DigitalOcean or VPS
- **Familiar with Heroku**: Heroku

---

**Your app is now accessible worldwide! 🚀**

