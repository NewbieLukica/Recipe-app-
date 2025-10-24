const express = require('express');
const path = require('path');
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = 3000;

// The name of the file in your Vercel Blob store.
const RECIPES_BLOB_KEY = 'recipes.json';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const readRecipesFromFile = async () => {
    try {
        // Check if the blob exists
        const blobList = await list({ prefix: RECIPES_BLOB_KEY, limit: 1 });
        if (blobList.blobs.length === 0) {
            // If the file doesn't exist in the blob store, return an empty array.
            return [];
        }
        const blob = blobList.blobs[0];
        // Fetch the content from the blob's public URL
        const response = await fetch(blob.url);
        if (!response.ok) {
            // If we can't fetch it for some reason, return an empty array to be safe.
            console.error(`Error fetching blob: ${response.statusText}`);
            return [];
        }
        return await response.json();
    } catch (error) {
        console.error('Error reading from Vercel Blob:', error);
        // If any other error occurs, return an empty array to prevent the app from crashing.
        return [];
    }
};

const writeRecipesToFile = async (recipes) => {
    const body = JSON.stringify(recipes, null, 2);
    // Upload the JSON string to Vercel Blob, making it publicly accessible.
    await put(RECIPES_BLOB_KEY, body, { access: 'public', addRandomSuffix: false });
};



const getPlatform = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    }
    if (url.includes('instagram.com')) {
        return 'instagram';
    }
    if (url.includes('tiktok.com')) {
        return 'tiktok';
    }
    return null;
};

app.get('/api/recipes', async (req, res) => {
    try {
        let recipes = await readRecipesFromFile();
        const filterPlatform = req.query.platform; 
        const filterCategory = req.query.category; 

        if (filterPlatform) {
            recipes = recipes.filter(recipe => getPlatform(recipe.link) === filterPlatform);
        }
        if (filterCategory) {
            recipes = recipes.filter(recipe => recipe.category === filterCategory);
        }
        res.json(recipes);
    } catch (error) {
        console.error('GET /api/recipes - Error:', error);
        res.status(500).send('Error retrieving recipes.');
    }
});


app.post('/api/recipes', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const newRecipe = {
            id: Date.now(), 
            ...req.body
        };
        recipes.push(newRecipe);
        await writeRecipesToFile(recipes);
        res.status(201).json(recipes); 
    } catch (error) {
        console.error('POST /api/recipes - Error:', error);
        res.status(500).send('Error saving new recipe.');
    }
});


app.put('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const idToUpdate = parseInt(req.params.id, 10);
        const recipeIndex = recipes.findIndex(recipe => recipe.id === idToUpdate);

        if (recipeIndex === -1) {
            return res.status(404).send('Recipe not found.');
        }

        recipes[recipeIndex] = { ...recipes[recipeIndex], ...req.body, id: idToUpdate };

        await writeRecipesToFile(recipes);
        res.status(200).json(recipes); 
    } catch (error) {
        console.error('PUT /api/recipes/:id - Error:', error);
        res.status(500).send('Error updating recipe.');
    }
});


app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const idToDelete = parseInt(req.params.id, 10);
        const updatedRecipes = recipes.filter(recipe => recipe.id !== idToDelete);

        await writeRecipesToFile(updatedRecipes);
        res.status(200).json(updatedRecipes); 
    } catch (error) {
        console.error('DELETE /api/recipes/:id - Error:', error);
        res.status(500).send('Error deleting recipe.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
