const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, 'data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const readRecipesFromFile = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(RECIPES_FILE, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {

                    return resolve([]);
                }

                return reject(err);
            }
            try {

                const recipes = data ? JSON.parse(data) : [];
                resolve(recipes);
            } catch (parseErr) {

                reject(parseErr);
            }
        });
    });
};

const writeRecipesToFile = (recipes) => {
    return fs.promises.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
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

    if (!fs.existsSync(DATA_DIR)){
        fs.mkdirSync(DATA_DIR);
        console.log(`Created data directory at: ${DATA_DIR}`);
    }
    console.log(`Server is running on http://localhost:${PORT}`);
});
