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
        const formData = new FormData(form);
        const newRecipe = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecipe),
            });

            if (!response.ok) throw new Error('Failed to add recipe');

            allRecipes = await response.json(); 
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

            allRecipes = await response.json();
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

        try {
            const response = await fetch(`/api/recipes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecipe),
            });

            if (!response.ok) throw new Error('Failed to update recipe.');

            allRecipes = await response.json(); 
            applyFilters();
            closeEditModal();
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

    fetchRecipes();
});