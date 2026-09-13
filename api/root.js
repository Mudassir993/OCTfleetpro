const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  try {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const tag = (src) => '\n<scr' + 'ipt src="' + src + '"></scr' + 'ipt>\n';
    const adapter = tag('/fleetpro-cloud.js?v=4') + tag('/equipment-display.js?v=3') + tag('/employee-blob.js?v=2') + tag('/admin-role-fix.js?v=3') + tag('/staff-production.js?v=2') + tag('/staff-production-fix.js?v=1') + tag('/staff-production-enhancements.js?v=1') + tag('/staff-production-enhancements-fix.js?v=1');
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
