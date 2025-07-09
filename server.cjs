const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/convert-upload', upload.single('shapefile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const tempDir = path.join(__dirname, 'uploads', `unzipped-${Date.now()}`);
    const inputFile = req.file.path;
    const intermediateGeoJSON = path.join(tempDir, 'intermediate.geojson');
    const outputNDJSON = path.join(tempDir, 'output.ndjson');

    try {
        await fs.promises.mkdir(tempDir, { recursive: true });
        await execPromise(`unzip -j "${inputFile}" -d "${tempDir}"`);

        const files = await fs.promises.readdir(tempDir);
        const shpFile = files.find(file => file.toLowerCase().endsWith('.shp'));

        if (!shpFile) {
            throw new Error('No .shp file found in the zip archive.');
        }

        const shpFilePath = path.join(tempDir, shpFile);

        // --- Step 1: Simple, reliable conversion to standard GeoJSON ---
        const command = `/usr/bin/ogr2ogr`;
        const args = ['-f', 'GeoJSON', intermediateGeoJSON, shpFilePath];
        const ogr2ogrProcess = spawn(command, args);

        let stderr = '';
        ogr2ogrProcess.stderr.on('data', (data) => { stderr += data.toString(); });
        await new Promise((resolve, reject) => {
            ogr2ogrProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ogr2ogr failed with code ${code}:\n${stderr}`));
            });
        });

        // --- Step 2: Create NDJSON with a Well-Known Text (WKT) string for geometry ---
        const geojsonData = await fs.promises.readFile(intermediateGeoJSON, 'utf8');
        const featureCollection = JSON.parse(geojsonData);
        
        const writeStream = fs.createWriteStream(outputNDJSON);

        featureCollection.features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 0) {
                const coordinates = feature.geometry.coordinates;

                // Ensure the line is "closed" for a valid polygon ring
                const firstPoint = coordinates[0];
                const lastPoint = coordinates[coordinates.length - 1];
                if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                    coordinates.push(firstPoint);
                }

                // **THE FIX**: Manually construct the WKT string.
                // It formats the coordinates as "lon lat, lon lat, ..."
                const pointsString = coordinates.map(point => point.join(' ')).join(', ');
                const wktString = `POLYGON((${pointsString}))`;

                // Construct the new feature object with the WKT string
                const featureForBigQuery = {
                    ...feature.properties,
                    geometry: wktString // The geometry is now a simple, unambiguous string
                };
                
                writeStream.write(JSON.stringify(featureForBigQuery) + '\n');
            }
        });

        writeStream.end();
        await new Promise(resolve => writeStream.on('finish', resolve));

        // --- Step 3: Send the final, correct file ---
        res.sendFile(path.resolve(outputNDJSON), (err) => {
            fs.unlink(inputFile, () => {});
            fs.rm(tempDir, { recursive: true, force: true }, () => {});
        });

    } catch (error) {
        console.error('--- PROCESSING FAILED ---', error);
        fs.unlink(inputFile, () => {});
        if (fs.existsSync(tempDir)) {
          fs.rm(tempDir, { recursive: true, force: true }, () => {});
        }
        res.status(500).json({ message: 'File conversion failed on the server', error: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});