const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  try {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const adapter = '\n<script src="/fleetpro-cloud.js?v=3"></script>\n<script src="/equipment-display.js?v=1"></script>\n';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.statusCode = 200;
    return res.end(html.includes('/fleetpro-cloud.js') ? html : html.replace('</body>', adapter + '</body>'));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: e.message }));
  }
};
