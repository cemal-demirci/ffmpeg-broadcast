// Cemal.cloud bcast Studio | test summaries for the CI page
//
// node --test runs each file in a child process and prints its output as
// "# ..." comments, so a workflow command written there never reaches the
// runner. Tests append to BCAST_NOTICES instead; the workflow prints the file.
'use strict';

const fs = require('fs');

function write(level, title, message) {
  const msg = String(message).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  const line = `::${level} title=${title}::${msg}\n`;
  if (process.env.BCAST_NOTICES) fs.appendFileSync(process.env.BCAST_NOTICES, line);
  else if (process.env.GITHUB_ACTIONS) process.stdout.write(line);
}

module.exports = (title, message) => write('notice', title, message);
module.exports.error = (title, message) => write('error', title, message);
