const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execPromise = promisify(exec);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/convert-upload', upload.single('shapefile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const tempDir = path.join(__dirname, 'uploads', `unzipped-${Date.now()}`);
    const inputFile = req.file.path;
    // We'll create two temporary files now
    const intermediateGeoJSON = `${tempDir}/intermediate.geojson`;
    const finalNDJSON = `${tempDir}/output.ndjson`;

    try {
        await fs.promises.mkdir(tempDir);
        await execPromise(`unzip -j "${inputFile}" -d "${tempDir}"`);

        const files = await fs.promises.readdir(tempDir);
        const shpFile = files.find(file => file.toLowerCase().endsWith('.shp'));

        if (!shpFile) {
            throw new Error('No .shp file found in the zip archive.');
        }

        const shpFilePath = path.join(tempDir, shpFile);
        // First, convert the shapefile to a standard GeoJSON FeatureCollection
        const command = `/usr/bin/ogr2ogr -f GeoJSON "${intermediateGeoJSON}" "${shpFilePath}"`;
        await execPromise(command);

        // --- NEW: Convert the GeoJSON to the correct NDJSON format ---
        const geojsonData = await fs.promises.readFile(intermediateGeoJSON, 'utf8');
        const featureCollection = JSON.parse(geojsonData);
        
        const writeStream = fs.createWriteStream(finalNDJSON);
        featureCollection.features.forEach(feature => {
            // Create a new object for each feature, combining properties and geometry
            const featureForBigQuery = {
                ...feature.properties,
                geometry: JSON.stringify(feature.geometry)
            };
            // Write each feature as a separate line in the output file
            writeStream.write(JSON.stringify(featureForBigQuery) + '\n');
        });
        writeStream.end();
        // --- End of new section ---

        // Wait for the write stream to finish before sending the file
        await new Promise(resolve => writeStream.on('finish', resolve));

        res.sendFile(path.resolve(finalNDJSON), (err) => {
            // Clean up all temporary files and directories
            fs.unlink(inputFile, () => {});
            fs.rm(tempDir, { recursive: true, force: true }, () => {});
        });

    } catch (error) {
        console.error('--- PROCESSING FAILED ---', error);
        // Ensure cleanup on failure
        fs.unlink(inputFile, () => {});
        fs.rm(tempDir, { recursive: true, force: true }, () => {});
        res.status(500).json({ message: 'File conversion failed', error: error.message });
    }
});

// Catch-all to serve the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});