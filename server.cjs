const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve the static React app from the 'dist' folder
app.use(express.static('dist'));

// API endpoint for file conversion
app.post('/api/convert', upload.single('shapefile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const inputFile = req.file.path;
  const outputFile = `${inputFile}.geojson`;
  const originalName = req.file.originalname;

  console.log(`[Backend] Received uploaded file: ${originalName}`);

  // Use ogr2ogr to convert the file
  const command = `ogr2ogr -f GeoJSON ${outputFile} ${inputFile}`;

  exec(command, (error, stdout, stderr) => {
    // Clean up the original uploaded file immediately
    fs.unlinkSync(inputFile);

    if (error) {
      console.error(`[Backend] ogr2ogr error: ${stderr}`);
      return res.status(500).json({ message: 'File conversion failed', error: stderr });
    }

    // Send the converted file back to the client
    res.sendFile(path.resolve(outputFile), (err) => {
      // Clean up the converted file after sending it
      fs.unlinkSync(outputFile);
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to send converted file' });
        }
      } else {
        console.log('[Backend] Sent converted file to client.');
      }
    });
  });
});

// All other GET requests should serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});