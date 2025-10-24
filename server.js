const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { put, head } = require('@vercel/blob');

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
            // Use `head` to directly look up the blob by its exact pathname.
            // This is more reliable than `list` with a prefix for a single file.
            const blob = await head(RECIPES_BLOB_KEY);
            
            // Use downloadUrl to bypass the CDN cache and get the latest version directly.
            const response = await fetch(blob.downloadUrl, { cache: 'no-store' });

            if (response.ok) {
                return await response.json();
            }

            // If response is not OK, log it and retry.
            console.error(`Attempt ${i + 1}: Error fetching blob: ${response.statusText}`);
        } catch (error) {
            // If the error is `BlobNotFoundError`, it means the file doesn't exist, which is a valid state.
            if (error.constructor.name === 'BlobNotFoundError') {
                console.log('Blob not found, returning empty array.');
                return [];
            }
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
        const recipes = await readRecipes();
        const newRecipe = {
            id: Date.now(), 
            ...req.body
        };
        recipes.push(newRecipe);
        await writeRecipes(recipes);
        // Return only the new recipe that was created.
        res.status(201).json(newRecipe); 
    } catch (error) {
        console.error('POST /api/recipes - Error:', error);
        res.status(500).send('Error saving new recipe.');
    }
});


app.put('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipes();
        const idToUpdate = parseInt(req.params.id, 10);
        const recipeIndex = recipes.findIndex(recipe => recipe.id === idToUpdate);

        if (recipeIndex === -1) {
            return res.status(404).send('Recipe not found.');
        }

        const updatedRecipe = { ...recipes[recipeIndex], ...req.body, id: idToUpdate };
        recipes[recipeIndex] = updatedRecipe;

        await writeRecipes(recipes);
        // Return only the updated recipe.
        res.status(200).json(updatedRecipe);
    } catch (error) {
        console.error('PUT /api/recipes/:id - Error:', error);
        res.status(500).send('Error updating recipe.');
    }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipes();
        const idToDelete = parseInt(req.params.id, 10);
        const updatedRecipes = recipes.filter(recipe => recipe.id !== idToDelete);

        await writeRecipes(updatedRecipes);
        // On success, just send back a success status.
        res.status(204).send(); 
    } catch (error) {
        console.error('DELETE /api/recipes/:id - Error:', error);
        res.status(500).send('Error deleting recipe.');
    }
});

app.listen(PORT, () => {
    console.log(`Running in ${isVercel ? 'Vercel (production)' : 'local'} mode.`);
    console.log(`Server is running on http://localhost:${PORT}`);
});
