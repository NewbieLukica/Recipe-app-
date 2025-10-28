document.addEventListener('DOMContentLoaded', () => {
    const recipeGrid = document.getElementById('recipe-grid');
    const form = document.getElementById('add-recipe-form');
    let allRecipes = []; 
    let displayedRecipes = []; 

    // Modal elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-recipe-form');
    const closeModalButton = document.querySelector('.close-button');

    // Custom Recipe Modal elements
    const openCustomRecipeBtn = document.getElementById('open-custom-recipe-modal-btn');
    const customRecipeModal = document.getElementById('custom-recipe-modal');
    const customRecipeForm = document.getElementById('custom-recipe-form');
    const closeCustomRecipeModalBtn = customRecipeModal.querySelector('.close-button');

    // View Recipe Modal elements
    const viewRecipeModal = document.getElementById('view-recipe-modal');
    const viewRecipeThumbnail = document.getElementById('view-recipe-thumbnail');
    const viewRecipeTitle = document.getElementById('view-recipe-title');
    const viewRecipeIngredients = document.getElementById('view-recipe-ingredients');

    // Filter elements
    const platformFilter = document.getElementById('platform-filter');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');
    const randomRecipeBtn = document.getElementById('random-recipe-btn');

    // Import/Export elements
    const exportBtn = document.getElementById('export-recipes-btn');
    const importBtn = document.getElementById('import-recipes-btn');
    const importInput = document.getElementById('import-recipes-input');

    // --- Recipe Count Display ---
    const updateRecipeCountDisplay = () => {
        const recipeCountElement = document.getElementById('recipe-count');
        if (!recipeCountElement) return;

        const total = allRecipes.length;
        const showing = displayedRecipes.length;

        if (total === showing || showing === 0) {
            recipeCountElement.textContent = `Total Recipes: ${total}`;
        } else {
            recipeCountElement.textContent = `Showing ${showing} of ${total} recipes`;
        }
    };

    // --- Helper Functions ---

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

    const getPlatformIcon = (url) => {
        if (!url) return '';
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return ''; 
        }
        if (url.includes('instagram.com')) {
            return '';
        }
        if (url.includes('tiktok.com')) {
            return '';
        }
        return '';
    };


    const displayRecipes = (recipes) => {
        recipeGrid.innerHTML = ''; // Clear existing recipes

        if (!recipes || recipes.length === 0) {
            recipeGrid.innerHTML = '<p>No recipes found. Add one using the form above!</p>';
            return;
        }

        recipes.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';

            const isCustom = 'ingredients' in recipe;
            const linkContent = !isCustom && recipe.link ? `href="${recipe.link}" target="_blank" rel="noopener noreferrer"` : 'href="#"';
            const platformIcon = getPlatformIcon(recipe.link);

            card.innerHTML = `
                <a ${linkContent} class="recipe-image-wrapper" ${isCustom ? `data-id="${recipe.id}" data-action="view-custom"` : ''}>
                    <img src="${recipe.thumbnail}" alt="${recipe.title}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Image+Not+Found';">
                    <div class="action-icon edit-icon" data-id="${recipe.id}" title="Edit Recipe">&#9998;</div> <!-- Pencil icon -->
                    <div class="action-icon delete-icon" data-id="${recipe.id}" title="Delete Recipe">&#10006;</div> <!-- X icon -->
                </a>
                <div class="recipe-card-content">
                    <h3>
                        <span class="recipe-title">${platformIcon} ${recipe.title}</span>
                        ${recipe.category ? `<span class="recipe-category">${recipe.category}</span>` : ''}
                    </h3>
                </div>
            `;
            recipeGrid.appendChild(card);
        });
    };

    const populatePlatformFilter = (recipes) => {
        const platforms = new Set();
        recipes.forEach(recipe => {
            const platform = getPlatform(recipe.link);
            if (platform) platforms.add(platform);
        });

        platformFilter.innerHTML = '<option value="">All Platforms</option>'; 
        platforms.forEach(platform => {
            const option = document.createElement('option');
            option.value = platform;
            option.textContent = platform.charAt(0).toUpperCase() + platform.slice(1); 
            platformFilter.appendChild(option);
        });
        platformFilter.value = platformFilter.dataset.selectedValue || '';
    };

    const applyFilters = () => {
        const selectedPlatform = platformFilter.value;
        const selectedCategory = categoryFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        const sortValue = sortFilter.value;

        displayedRecipes = allRecipes.filter(recipe => {
            const platformMatch = !selectedPlatform || getPlatform(recipe.link) === selectedPlatform;
            const categoryMatch = !selectedCategory || recipe.category === selectedCategory;
            const searchMatch = !searchTerm || recipe.title.toLowerCase().includes(searchTerm);
            return platformMatch && categoryMatch && searchMatch;
        });

        // Sort the filtered recipes
        if (sortValue === 'newest') {
            // Newest first (descending by id/timestamp)
            displayedRecipes.sort((a, b) => b.id - a.id);
        } else if (sortValue === 'oldest') {
            // Oldest first (ascending by id/timestamp)
            displayedRecipes.sort((a, b) => a.id - b.id);
        }
        // 'default' will keep the natural order from the server (which is oldest to newest)
        
        displayRecipes(displayedRecipes);
        updateRecipeCountDisplay();
    };

    const fetchRecipes = async () => {
        try {
            const response = await fetch('/api/recipes');
            if (!response.ok) {
                throw new Error('Could not load recipes. Is the server running?');
            }
            allRecipes = await response.json();
            // Default sort: newest to oldest
            allRecipes.sort((a, b) => b.id - a.id);
            populatePlatformFilter(allRecipes); 
            applyFilters(); 
        } catch (error) {
            console.error('Fetch error:', error);
            recipeGrid.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    };

    const addRecipe = async (event) => {
        event.preventDefault();
        const newRecipeData = Object.fromEntries(new FormData(form).entries());
        const tempId = Date.now(); // Create a temporary ID for optimistic update
        const newRecipe = { id: tempId, ...newRecipeData };

        // Optimistic UI update
        allRecipes.unshift(newRecipe); // Add to the start of the array
        applyFilters();
        form.reset();

        try {
            const response = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecipe),
            });

            if (!response.ok) throw new Error('Failed to add recipe');

            // Replace the temporary recipe with the final one from the server
            const finalRecipe = await response.json();
            const index = allRecipes.findIndex(r => r.id === tempId);
            if (index !== -1) allRecipes[index] = finalRecipe;
            applyFilters(); // Re-render to be safe
        } catch (error) {
            console.error('Error adding recipe:', error);
            alert('There was an error adding your recipe. Please try again.');
        }
    };

    const addCustomRecipe = async (event) => {
        event.preventDefault();
        const newRecipeData = Object.fromEntries(new FormData(customRecipeForm).entries());
        const tempId = Date.now();
        const newRecipe = { id: tempId, ...newRecipeData };

        // Optimistic UI update
        const originalRecipes = [...allRecipes];
        allRecipes.unshift(newRecipe);
        applyFilters();
        customRecipeForm.reset();
        customRecipeModal.style.display = 'none';

        try {
            const response = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecipe),
            });

            if (!response.ok) throw new Error('Failed to add custom recipe');

            // Replace the temporary recipe with the final one from the server
            const finalRecipe = await response.json();
            const index = allRecipes.findIndex(r => r.id === tempId);
            if (index !== -1) allRecipes[index] = finalRecipe;
            applyFilters(); // Re-render
        } catch (error) {
            console.error('Error adding custom recipe:', error);
            alert('There was an error adding your custom recipe. Please try again.');
            // Revert optimistic update on failure
            allRecipes = originalRecipes;
            applyFilters();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this recipe?')) {
            return;
        }

        // Optimistic UI update
        allRecipes = allRecipes.filter(recipe => recipe.id !== id);
        applyFilters();

        try {
            const response = await fetch(`/api/recipes/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete recipe.');

            // No need to do anything on success, UI is already updated.
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('There was an error deleting the recipe.');
        }
    };

    const openEditModal = (id) => {
        const recipeToEdit = allRecipes.find(r => r.id === id);
        if (!recipeToEdit) return;

        const isCustom = 'ingredients' in recipeToEdit;


        editForm.querySelector('[data-recipe-type="custom"]').style.display = isCustom ? 'flex' : 'none';
        editForm.querySelector('[data-recipe-type="link"]').style.display = isCustom ? 'none' : 'flex';


        editForm.querySelector('#edit-id').value = recipeToEdit.id;
        editForm.querySelector('#edit-title').value = recipeToEdit.title;
        editForm.querySelector('#edit-thumbnail').value = recipeToEdit.thumbnail;

        if (isCustom) {
            editForm.querySelector('#edit-ingredients').value = recipeToEdit.ingredients || '';

            editForm.querySelector('#edit-link').value = '';
            editForm.querySelector('#edit-category').value = '';
        } else {
            editForm.querySelector('#edit-link').value = recipeToEdit.link || '';
            editForm.querySelector('#edit-category').value = recipeToEdit.category || '';

            editForm.querySelector('#edit-ingredients').value = '';
        }
        
        editModal.style.display = 'flex';
    };

    const closeEditModal = () => {
        editModal.style.display = 'none';
    };

    const openViewModal = (id) => {
        const recipeToView = allRecipes.find(r => r.id === id);
        if (!recipeToView) return;

        viewRecipeThumbnail.src = recipeToView.thumbnail;
        viewRecipeThumbnail.alt = recipeToView.title;
        viewRecipeTitle.textContent = recipeToView.title;
        viewRecipeIngredients.textContent = recipeToView.ingredients;
        viewRecipeModal.style.display = 'flex';


        viewRecipeModal.querySelector('.close-button').onclick = () => viewRecipeModal.style.display = 'none';
    };

    const handleEditSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(editForm);
        const id = formData.get('id');
        let updatedRecipe = Object.fromEntries(formData.entries());

        if (updatedRecipe.ingredients === '') {
            delete updatedRecipe.ingredients;
        } else {
            delete updatedRecipe.link;
            delete updatedRecipe.category;
        }
        
        // Optimistic UI update
        const recipeIndex = allRecipes.findIndex(r => r.id === parseInt(id, 10));
        if (recipeIndex !== -1) {
            allRecipes[recipeIndex] = { ...allRecipes[recipeIndex], ...updatedRecipe };
        }
        applyFilters();
        closeEditModal();

        try {
            const response = await fetch(`/api/recipes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecipe), // Send the cleaned-up recipe
            });

            if (!response.ok) throw new Error('Failed to update recipe.');
            
            // Optionally, update the local recipe with the final one from the server
            const finalRecipe = await response.json();
            if (recipeIndex !== -1) allRecipes[recipeIndex] = finalRecipe;
            applyFilters(); // Re-render to be safe
        } catch (error) {
            console.error('Error updating recipe:', error);
            alert('There was an error updating the recipe.');
        }
    };


    form.addEventListener('submit', addRecipe);
    editForm.addEventListener('submit', handleEditSubmit);
    closeModalButton.addEventListener('click', closeEditModal);
    openCustomRecipeBtn.addEventListener('click', () => customRecipeModal.style.display = 'flex');
    closeCustomRecipeModalBtn.addEventListener('click', () => customRecipeModal.style.display = 'none');
    customRecipeForm.addEventListener('submit', addCustomRecipe);


    recipeGrid.addEventListener('click', (event) => { 

        const target = event.target;
        const id = parseInt(target.dataset.id, 10);
        if (target.classList.contains('delete-icon')) {
            event.preventDefault(); 
            event.stopPropagation(); 

            handleDelete(id);
        } else if (target.classList.contains('edit-icon')) {
            event.preventDefault(); 
            event.stopPropagation(); 
            openEditModal(id);
        } else if (target.closest('[data-action="view-custom"]')) {
            event.preventDefault(); 
            const customRecipeId = parseInt(target.closest('[data-action="view-custom"]').dataset.id, 10);
            openViewModal(customRecipeId);
        }
    });


    platformFilter.addEventListener('change', () => {
        platformFilter.dataset.selectedValue = platformFilter.value; 
        applyFilters();
    });
    searchInput.addEventListener('input', () => {
        applyFilters();
    });

    categoryFilter.addEventListener('change', () => {
        applyFilters();
    });

    sortFilter.addEventListener('change', () => {
        applyFilters();
    });

    randomRecipeBtn.addEventListener('click', () => {
        if (displayedRecipes.length === 0) {
            alert('No recipes to choose from. Try adjusting your filters!');
            return;
        }

        const randomIndex = Math.floor(Math.random() * displayedRecipes.length);
        const randomRecipe = displayedRecipes[randomIndex];

        const isCustom = 'ingredients' in randomRecipe;

        if (isCustom) {
            openViewModal(randomRecipe.id);
        } else if (randomRecipe.link) {
            window.open(randomRecipe.link, '_blank');
        } else {
            alert(`Here is your random recipe: ${randomRecipe.title}`);
        }
    });

    // --- Import/Export Functionality ---

    const handleExport = () => {
        if (displayedRecipes.length === 0) {
            alert('No recipes to export. Try adjusting your filters!');
            return;
        }

        // Create a blob with the currently displayed recipes
        const blob = new Blob([JSON.stringify(displayedRecipes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link to trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recipes.json';
        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedRecipes = JSON.parse(e.target.result);
                if (!Array.isArray(importedRecipes)) {
                    throw new Error('Invalid JSON format: must be an array of recipes.');
                }

                if (!confirm(`This will add ${importedRecipes.length} new recipe(s). Continue?`)) {
                    return;
                }

                const response = await fetch('/api/recipes/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(importedRecipes),
                });

                if (!response.ok) throw new Error('Failed to import recipes.');

                alert('Recipes imported successfully!');
                fetchRecipes(); // Refresh the recipe list
            } catch (error) {
                console.error('Error importing recipes:', error);
                alert(`Failed to import recipes: ${error.message}`);
            } finally {
                importInput.value = ''; // Reset input for next import
            }
        };
        reader.readAsText(file);
    };

    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImport);

    fetchRecipes();
});