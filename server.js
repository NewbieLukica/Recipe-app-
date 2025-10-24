const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = 3000;

// The name of the file in your Vercel Blob store.
const RECIPES_BLOB_KEY = 'web-recipes.json';
// The path to your local JSON file.
const RECIPES_FILE_PATH = path.join(__dirname, 'data', 'recipes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Vercel Blob Storage Functions ---

const readRecipesFromBlob = async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const blobList = await list({ prefix: RECIPES_BLOB_KEY, limit: 1 });
            if (blobList.blobs.length === 0) {
                return []; // File doesn't exist yet, which is a valid state.
            }

            const blob = blobList.blobs[0];
            // Use downloadUrl to bypass the CDN cache and get the latest version directly.
            const response = await fetch(blob.downloadUrl, { cache: 'no-store' });

            if (response.ok) {
                return await response.json();
            }

            // If response is not OK, log it and retry.
            console.error(`Attempt ${i + 1}: Error fetching blob: ${response.statusText}`);
        } catch (error) {
            // If fetch itself fails, log it and retry.
            console.error(`Attempt ${i + 1}: Error reading from Vercel Blob:`, error);
        }
        // Wait before the next attempt.
        if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    console.error('Failed to read from Vercel Blob after all retries.');
    return []; // Return empty array after all retries fail.
};

const writeRecipesToBlob = async (recipes) => {
    const body = JSON.stringify(recipes, null, 2);
    // We must allow overwrites because we are always updating the same file.
    await put(RECIPES_BLOB_KEY, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
    });
};

// --- Local File Storage Functions ---

const readRecipesFromLocalFile = async () => {
    try {
        const data = await fs.readFile(RECIPES_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // File doesn't exist, return empty array
        }
        throw error;
    }
};

const writeRecipesToLocalFile = async (recipes) => {
    await fs.writeFile(RECIPES_FILE_PATH, JSON.stringify(recipes, null, 2), 'utf8');
};

// --- Environment-aware Storage Functions ---

// Use Vercel's official environment variable to detect production.
const isVercel = process.env.VERCEL_ENV === 'production';

const readRecipes = isVercel ? readRecipesFromBlob : readRecipesFromLocalFile;
const writeRecipes = isVercel ? writeRecipesToBlob : writeRecipesToLocalFile;

// A robust function to handle read-modify-write operations on the blob storage.
// For Vercel Blob, we rely on readRecipes's internal retries to get the latest data
// before modification, and trust writeRecipes to perform the update.
// The immediate read-back verification loop was causing issues due to eventual consistency.
const performLockedUpdate = async (updateFunction) => {
    if (!isVercel) {
        // For local files, race conditions are not an issue.
        const recipes = await readRecipes();
        const updatedRecipes = updateFunction(recipes);
        await writeRecipes(updatedRecipes);
        return updatedRecipes;
    }

    // For Vercel, perform a read-modify-write.
    // readRecipes already includes retry logic to fetch the most recent data.
    try {
        const recipes = await readRecipes();
        const updatedRecipes = updateFunction(recipes);
        await writeRecipes(updatedRecipes);
        return updatedRecipes;
    } catch (error) {
        console.error('Error in performLockedUpdate (Vercel mode):', error);
        throw new Error("Failed to update recipes due to a storage issue. Please try again.");
    }
};

app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await readRecipes();
        res.json(recipes);
    } catch (error) {
        console.error('GET /api/recipes - Error:', error);
        res.status(500).send('Error retrieving recipes.');
    }
});


app.post('/api/recipes', async (req, res) => {
    try {
        const updatedRecipes = await performLockedUpdate((recipes) => {
            const newRecipe = { id: Date.now(), ...req.body };
            recipes.push(newRecipe);
            return recipes;
        });
        res.status(201).json(updatedRecipes);
    } catch (error) {
        console.error('POST /api/recipes - Error:', error);
        res.status(500).send('Error saving new recipe.');
    }
});


app.put('/api/recipes/:id', async (req, res) => {
    try {
        const idToUpdate = parseInt(req.params.id, 10);
        const updatedRecipes = await performLockedUpdate((recipes) => {
            const recipeIndex = recipes.findIndex(recipe => recipe.id === idToUpdate);
            if (recipeIndex === -1) { // If recipe not found, throw a specific error
                const error = new Error('Recipe not found.');
                error.statusCode = 404; // Custom property to identify the error type
                throw error;
            }
            recipes[recipeIndex] = { ...recipes[recipeIndex], ...req.body, id: idToUpdate };
            return recipes;
        });
        res.status(200).json(updatedRecipes);
    } catch (error) {
        console.error('PUT /api/recipes/:id - Error:', error); // Log the error for debugging
        if (error.statusCode === 404) return res.status(404).send(error.message); // Return 404 for not found
        res.status(500).send('Error updating recipe.'); // Generic 500 for other errors
    }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const idToDelete = parseInt(req.params.id, 10);
        const finalRecipes = await performLockedUpdate((recipes) => {
            return recipes.filter(recipe => recipe.id !== idToDelete);
        });
        res.status(200).json(finalRecipes);
    } catch (error) {
        console.error('DELETE /api/recipes/:id - Error:', error);
        res.status(500).send('Error deleting recipe.');
    }
});

app.listen(PORT, () => {
    console.log(`Running in ${isVercel ? 'Vercel (production)' : 'local'} mode.`);
    console.log(`Server is running on http://localhost:${PORT}`);
});
