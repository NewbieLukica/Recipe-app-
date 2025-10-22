document.addEventListener('DOMContentLoaded', () => {
    const recipeGrid = document.getElementById('recipe-grid');
    const form = document.getElementById('add-recipe-form');
    let allRecipes = []; // This will hold the master list of all recipes
    let displayedRecipes = []; // This will hold the filtered list for display

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
    const categoryFilter = document.getElementById('category-filter');


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
            // Removed YouTube icon as per request
            return ''; 
        }
        if (url.includes('instagram.com')) {
            // Removed Instagram icon as per request
            return '';
        }
        if (url.includes('tiktok.com')) {
            // Removed TikTok icon as per request
            return '';
        }
        return '';
    };

    // --- Core Functions ---

    const displayRecipes = (recipes) => {
        recipeGrid.innerHTML = ''; // Clear existing recipes

        if (!recipes || recipes.length === 0) {
            recipeGrid.innerHTML = '<p>No recipes found. Add one using the form above!</p>';
            return;
        }

        // Create a reversed copy to display newest recipes first
        const recipesToDisplay = [...recipes].reverse();

        recipesToDisplay.forEach(recipe => {
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

        platformFilter.innerHTML = '<option value="">All Platforms</option>'; // Reset
        platforms.forEach(platform => {
            const option = document.createElement('option');
            option.value = platform;
            option.textContent = platform.charAt(0).toUpperCase() + platform.slice(1); // Capitalize
            platformFilter.appendChild(option);
        });
        // Restore selected value if it was set
        platformFilter.value = platformFilter.dataset.selectedValue || '';
    };

    const applyFilters = () => {
        const selectedPlatform = platformFilter.value;
        const selectedCategory = categoryFilter.value;

        displayedRecipes = allRecipes.filter(recipe => {
            const platformMatch = !selectedPlatform || getPlatform(recipe.link) === selectedPlatform;
            const categoryMatch = !selectedCategory || recipe.category === selectedCategory;
            return platformMatch && categoryMatch;
        });

        displayRecipes(displayedRecipes);
    };

    const fetchRecipes = async () => {
        try {
            const response = await fetch('/api/recipes');
            if (!response.ok) {
                throw new Error('Could not load recipes. Is the server running?');
            }
            allRecipes = await response.json();
            populatePlatformFilter(allRecipes); // Populate filters from the full list
            applyFilters(); // Apply any active filters and display
        } catch (error) {
            console.error('Fetch error:', error);
            recipeGrid.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    };

    const addRecipe = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const newRecipe = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecipe),
            });

            if (!response.ok) throw new Error('Failed to add recipe');

            allRecipes = await response.json(); // Server sends back the full updated list
            applyFilters();
            form.reset();
        } catch (error) {
            console.error('Error adding recipe:', error);
            alert('There was an error adding your recipe. Please try again.');
        }
    };

    const addCustomRecipe = async (event) => {
        event.preventDefault();
        const formData = new FormData(customRecipeForm);
        const newRecipe = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecipe),
            });

            if (!response.ok) throw new Error('Failed to add custom recipe');

            allRecipes = await response.json();
            applyFilters();
            customRecipeForm.reset();
            customRecipeModal.style.display = 'none';
        } catch (error) {
            console.error('Error adding custom recipe:', error);
            alert('There was an error adding your custom recipe. Please try again.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this recipe?')) {
            return;
        }

        try {
            const response = await fetch(`/api/recipes/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete recipe.');

            allRecipes = await response.json(); // Server sends back the updated list
            applyFilters();
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('There was an error deleting the recipe.');
        }
    };

    const openEditModal = (id) => {
        const recipeToEdit = allRecipes.find(r => r.id === id);
        if (!recipeToEdit) return;

        const isCustom = 'ingredients' in recipeToEdit;

        // Show/hide fields based on recipe type
        editForm.querySelector('[data-recipe-type="custom"]').style.display = isCustom ? 'flex' : 'none';
        editForm.querySelector('[data-recipe-type="link"]').style.display = isCustom ? 'none' : 'flex';

        // Populate the form in the modal
        editForm.querySelector('#edit-id').value = recipeToEdit.id;
        editForm.querySelector('#edit-title').value = recipeToEdit.title;
        editForm.querySelector('#edit-thumbnail').value = recipeToEdit.thumbnail;

        if (isCustom) {
            editForm.querySelector('#edit-ingredients').value = recipeToEdit.ingredients || '';
            // Clear link-recipe fields
            editForm.querySelector('#edit-link').value = '';
            editForm.querySelector('#edit-category').value = '';
        } else {
            editForm.querySelector('#edit-link').value = recipeToEdit.link || '';
            editForm.querySelector('#edit-category').value = recipeToEdit.category || '';
            // Clear custom-recipe fields
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

        // Add a listener to the close button for this specific modal
        viewRecipeModal.querySelector('.close-button').onclick = () => viewRecipeModal.style.display = 'none';
    };

    const handleEditSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(editForm);
        const id = formData.get('id');
        let updatedRecipe = Object.fromEntries(formData.entries());

        // Clean up the object before sending
        if (updatedRecipe.ingredients === '') {
            delete updatedRecipe.ingredients;
        } else {
            delete updatedRecipe.link;
            delete updatedRecipe.category;
        }

        try {
            const response = await fetch(`/api/recipes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecipe),
            });

            if (!response.ok) throw new Error('Failed to update recipe.');

            allRecipes = await response.json(); // Server sends back the updated list
            applyFilters();
            closeEditModal();
        } catch (error) {
            console.error('Error updating recipe:', error);
            alert('There was an error updating the recipe.');
        }
    };

    // --- Event Listeners ---
    form.addEventListener('submit', addRecipe);
    editForm.addEventListener('submit', handleEditSubmit);
    closeModalButton.addEventListener('click', closeEditModal);
    openCustomRecipeBtn.addEventListener('click', () => customRecipeModal.style.display = 'flex');
    closeCustomRecipeModalBtn.addEventListener('click', () => customRecipeModal.style.display = 'none');
    customRecipeForm.addEventListener('submit', addCustomRecipe);

    // Use event delegation for edit/delete buttons
    recipeGrid.addEventListener('click', (event) => { // Changed from 'buttons' to 'icons'
        const target = event.target;
        const id = parseInt(target.dataset.id, 10);
        if (target.classList.contains('delete-icon')) {
            event.preventDefault(); // Stop the link from opening
            event.stopPropagation(); // Stop the event from bubbling up
            handleDelete(id);
        } else if (target.classList.contains('edit-icon')) {
            event.preventDefault(); // Stop the link from opening
            event.stopPropagation(); // Stop the event from bubbling up
            openEditModal(id);
        } else if (target.closest('[data-action="view-custom"]')) {
            event.preventDefault(); // Stop the link from opening
            const customRecipeId = parseInt(target.closest('[data-action="view-custom"]').dataset.id, 10);
            openViewModal(customRecipeId);
        }
    });

    // Filter event listeners
    platformFilter.addEventListener('change', () => {
        platformFilter.dataset.selectedValue = platformFilter.value; // Store selected value
        applyFilters();
    });
    categoryFilter.addEventListener('change', () => {
        categoryFilter.dataset.selectedValue = categoryFilter.value; // Store selected value
        applyFilters();
    });

    // --- Initial Load ---
    fetchRecipes();
});