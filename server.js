const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');

// Middleware to parse JSON body and serve static files from 'public' folder
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Refactored Helper Functions for File I/O ---

const readRecipesFromFile = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(RECIPES_FILE, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // File doesn't exist, which is fine. Start with an empty array.
                    return resolve([]);
                }
                // Other reading error
                return reject(err);
            }
            try {
                // If file is empty, data will be an empty string, which is not valid JSON
                const recipes = data ? JSON.parse(data) : [];
                resolve(recipes);
            } catch (parseErr) {
                // JSON parsing error
                reject(parseErr);
            }
        });
    });
};

const writeRecipesToFile = (recipes) => {
    return fs.promises.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
};


// Helper function to determine platform from URL (duplicated from frontend for server-side filtering)
const getPlatform = (url) => {
    if (!url) return null; // Guard against undefined or null URLs
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
// API Endpoint: GET all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        let recipes = await readRecipesFromFile();
        const filterPlatform = req.query.platform; // Get the platform from query parameter
        const filterCategory = req.query.category; // Get the category from query parameter

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

// API Endpoint: POST a new recipe
app.post('/api/recipes', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const newRecipe = {
            id: Date.now(), // Simple unique ID
            ...req.body
        };
        recipes.push(newRecipe);
        await writeRecipesToFile(recipes);
        res.status(201).json(recipes); // Return the full updated list
    } catch (error) {
        console.error('POST /api/recipes - Error:', error);
        res.status(500).send('Error saving new recipe.');
    }
});

// API Endpoint: PUT (update) an existing recipe
app.put('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const idToUpdate = parseInt(req.params.id, 10);
        const recipeIndex = recipes.findIndex(recipe => recipe.id === idToUpdate);

        if (recipeIndex === -1) {
            return res.status(404).send('Recipe not found.');
        }

        // Update the recipe, but keep its original ID
        recipes[recipeIndex] = { ...recipes[recipeIndex], ...req.body, id: idToUpdate };

        await writeRecipesToFile(recipes);
        res.status(200).json(recipes); // Return the full updated list
    } catch (error) {
        console.error('PUT /api/recipes/:id - Error:', error);
        res.status(500).send('Error updating recipe.');
    }
});

// API Endpoint: DELETE a recipe
app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const recipes = await readRecipesFromFile();
        const idToDelete = parseInt(req.params.id, 10);
        const updatedRecipes = recipes.filter(recipe => recipe.id !== idToDelete);

        await writeRecipesToFile(updatedRecipes);
        res.status(200).json(updatedRecipes); // Return the full updated list
    } catch (error) {
        console.error('DELETE /api/recipes/:id - Error:', error);
        res.status(500).send('Error deleting recipe.');
    }
});

app.listen(PORT, () => {
    // Ensure the data directory exists before starting the server
    if (!fs.existsSync(DATA_DIR)){
        fs.mkdirSync(DATA_DIR);
        console.log(`Created data directory at: ${DATA_DIR}`);
    }
    console.log(`Server is running on http://localhost:${PORT}`);
});
