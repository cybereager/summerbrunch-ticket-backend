// Cron job to hit endpoint every 14 minutes to keep backend alive
const cron = require('cron');
const https = require('https');

// Define the backend URL
const backendUrl = 'https://football-api-backend.onrender.com'; // Change this to your backend API URL

// Set up the cron job to run every 14 minutes
const job = new cron.CronJob('*/14 * * * *', function() {
  console.log('Pinging server to keep it alive...');

  // Perform an HTTPS GET request to hit the backend API
  https.get(backendUrl, (res) => {
    if (res.statusCode === 200) {
      console.log('Server is active');
    } else {
      console.error(`Failed to ping server with status code: ${res.statusCode}`);
    }
  }).on('error', (err) => {
    console.error('Error during server wakeup:', err.message);
  });
});

// Export the cron job
module.exports = {
  job,
};
