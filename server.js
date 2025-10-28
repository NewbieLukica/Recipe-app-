const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { put, head } = require('@vercel/blob');
const basicAuth = require('basic-auth');

const app = express();
const PORT = 3000;

// The name of the file in your Vercel Blob store.
const RECIPES_BLOB_KEY = 'web-recipes.json';
// The path to your local JSON file.
const RECIPES_FILE_PATH = path.join(__dirname, 'data', 'recipes.json');
const LOGIN_LOGS_BLOB_KEY = 'web-login-logs.json';
const LOGIN_LOGS_FILE_PATH = path.join(__dirname, 'data', 'login-logs.json');

// --- Authentication Middleware ---
const auth = (req, res, next) => {
  const credentials = basicAuth(req);
  const validUsers = ['luka', 'nina'];
  const validPassword = '2923';

  if (
    !credentials ||
    !validUsers.includes(credentials.name) ||
    credentials.pass !== validPassword
  ) {
    res.setHeader('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }

  // User is authenticated
  // Log the login time asynchronously
  logLogin(credentials.name).catch(error => {
    console.error(`Failed to log login for ${credentials.name}:`, error);
  });

  next();
};

// Apply authentication to all routes
app.use(auth);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Vercel Blob Storage Functions ---

const readRecipesFromBlob = async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            // Use `head` to directly look up the blob by its exact pathname.
            // This is more reliable than `list` with a prefix for a single file.
            const blob = await head(RECIPES_BLOB_KEY);
            
            // To ensure we get the latest version and bypass any caches,
            // we'll fetch from the blob's primary URL and add a unique query
            // parameter (cache buster) to the request.
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(`${blob.url}${cacheBuster}`);

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

// --- Vercel Blob Storage Functions for Login Logs ---

const readLoginLogsFromBlob = async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const blob = await head(LOGIN_LOGS_BLOB_KEY);
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(`${blob.url}${cacheBuster}`);

            if (response.ok) {
                return await response.json();
            }
            console.error(`Attempt ${i + 1}: Error fetching login logs blob: ${response.statusText}`);
        } catch (error) {
            if (error.constructor.name === 'BlobNotFoundError') {
                console.log('Login logs blob not found, returning empty object.');
                return {};
            }
            console.error(`Attempt ${i + 1}: Error reading login logs from Vercel Blob:`, error);
        }
        if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    console.error('Failed to read login logs from Vercel Blob after all retries.');
    return {};
};

const writeLoginLogsToBlob = async (logs) => {
    const body = JSON.stringify(logs, null, 2);
    await put(LOGIN_LOGS_BLOB_KEY, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
    });
};

const readLoginLogsFromLocalFile = async () => {
    try {
        const data = await fs.readFile(LOGIN_LOGS_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // File doesn't exist, return empty object
        }
        throw error;
    }
};

const writeLoginLogsToLocalFile = async (logs) => {
    await fs.writeFile(LOGIN_LOGS_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
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

const readLoginLogs = isVercel ? readLoginLogsFromBlob : readLoginLogsFromLocalFile;
const writeLoginLogs = isVercel ? writeLoginLogsToBlob : writeLoginLogsToLocalFile;

const logLogin = async (username) => {
    const logs = await readLoginLogs();
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Europe/Zagreb' // Timezone for Croatia
    };
    const croatianTime = new Date().toLocaleString('hr-HR', options);
    logs[username] = croatianTime;
    await writeLoginLogs(logs);
};

app.get('/api/last-logins', async (req, res) => {
    const logs = await readLoginLogs();
    res.json(logs);
});

/**
 * A robust function to handle read-modify-write operations, preventing race conditions.
 * It retries the operation if the data changes during the process.
 */
const performLockedUpdate = async (updateFunction) => {
    // For local files, race conditions are not an issue.
    if (!isVercel) {
        const recipes = await readRecipes();
        const updatedRecipes = updateFunction(recipes);
        await writeRecipes(updatedRecipes);
        return updatedRecipes;
    }

    // For Vercel, implement a read-modify-write-verify loop.
    for (let i = 0; i < 5; i++) { // Try up to 5 times
        const recipesBeforeUpdate = await readRecipes();
        const recipesAfterUpdate = updateFunction([...recipesBeforeUpdate]); // Use a copy

        await writeRecipes(recipesAfterUpdate);

        // Immediately read back to verify our write was the last one.
        const recipesAfterWrite = await readRecipes();
        if (JSON.stringify(recipesAfterWrite) === JSON.stringify(recipesAfterUpdate)) {
            return recipesAfterUpdate; // Success! Our change is stable.
        }

        // If not, another process interfered. Wait a bit and retry the whole operation.
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    }

    throw new Error("Failed to update recipes due to high concurrency. Please try again.");
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
        let createdRecipe;
        await performLockedUpdate((recipes) => {
            // The client sends a temporary ID, which we will use.
            // If the client didn't send one for some reason, we'd fall back, but it should.
            const id = req.body.id || Date.now();
            createdRecipe = { ...req.body, id };
            recipes.push(createdRecipe);
            return recipes;
        });
        res.status(201).json(createdRecipe);
    } catch (error) {
        console.error('POST /api/recipes - Error:', error);
        res.status(500).send('Error saving new recipe.');
    }
});

app.post('/api/recipes/import', async (req, res) => {
    try {
        const recipesToImport = req.body;
        if (!Array.isArray(recipesToImport)) {
            return res.status(400).send('Invalid input: body must be an array of recipes.');
        }

        await performLockedUpdate((existingRecipes) => {
            // Create a Set of existing IDs for quick lookup
            const existingIds = new Set(existingRecipes.map(r => r.id));
            recipesToImport.forEach(recipe => {
                // Assign a new ID if it's missing or already exists
                if (!recipe.id || existingIds.has(recipe.id)) {
                    recipe.id = Date.now() + Math.random(); // Ensure uniqueness
                }
                existingRecipes.push(recipe);
            });
            return existingRecipes;
        });
        res.status(201).send('Recipes imported successfully.');
    } catch (error) {
        console.error('POST /api/recipes/import - Error:', error);
        res.status(500).send('Error importing recipes.');
    }
});

app.put('/api/recipes/:id', async (req, res) => {
    try {
        const idToUpdate = parseInt(req.params.id, 10);
        let finalRecipe;
        await performLockedUpdate((recipes) => {
            const recipeIndex = recipes.findIndex(recipe => recipe.id === idToUpdate);
            if (recipeIndex === -1) {
                throw new Error('Recipe not found during update.');
            }
            finalRecipe = { ...recipes[recipeIndex], ...req.body, id: idToUpdate };
            recipes[recipeIndex] = finalRecipe;
            return recipes;
        });
        res.status(200).json(finalRecipe);
    } catch (error) {
        console.error('PUT /api/recipes/:id - Error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).send('Error updating recipe.');
    }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const idToDelete = parseInt(req.params.id, 10);
        await performLockedUpdate((recipes) => {
            return recipes.filter(recipe => recipe.id !== idToDelete);
        });
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
