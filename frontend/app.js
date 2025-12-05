const apiBase = window.location.origin.includes('3000')
  ? 'http://localhost:4000'
  : window.location.origin;
const API_URL = `${apiBase}/api`;

const listEl = document.getElementById('recipes-list');
const detailEl = document.getElementById('recipe-detail');
const statusEl = document.getElementById('status');
const filterEl = document.getElementById('filter');
const reloadBtn = document.getElementById('reload-btn');

let recipes = [];
let filtered = [];

function setStatus(message, type = 'success') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function renderList(items) {
  listEl.innerHTML = '';
  if (!items.length) {
    listEl.innerHTML = '<li class="recipe-card">No recipes saved yet.</li>';
    return;
  }

  items.forEach((recipe) => {
    const li = document.createElement('li');
    li.className = 'recipe-card';
    li.innerHTML = `
      <div>
        <div class="eyebrow" style="margin:0">${recipe.sourceUrl ? new URL(recipe.sourceUrl).hostname : 'Recipe'}</div>
        <div><strong>${recipe.title}</strong></div>
        <div class="recipe-card__meta">${recipe.description?.slice(0, 120) || 'No description'}</div>
        <div class="meta-grid">
          ${recipe.totalTime ? `<span class="pill">⏱️ ${recipe.totalTime}</span>` : ''}
          ${recipe.servings ? `<span class="pill">🍽 ${recipe.servings}</span>` : ''}
        </div>
      </div>
      <button class="delete-btn" data-id="${recipe.id}">Delete</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      renderDetail(recipe);
    });

    li.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteRecipe(recipe.id);
    });

    listEl.appendChild(li);
  });
}

function renderDetail(recipe) {
  if (!recipe) {
    detailEl.classList.add('empty');
    detailEl.innerHTML = '<p>Select a recipe to see the normalized format.</p>';
    return;
  }

  detailEl.classList.remove('empty');
  const ingredients = recipe.ingredients?.length
    ? recipe.ingredients.map((i) => `<li>${i}</li>`).join('')
    : '<li>No ingredients captured</li>';
  const instructions = recipe.instructions?.length
    ? recipe.instructions.map((i) => `<li>${i}</li>`).join('')
    : '<li>No instructions captured</li>';

  detailEl.innerHTML = `
    <div class="header">
      <h3>${recipe.title}</h3>
      ${recipe.sourceUrl ? `<p class="recipe-card__meta"><a href="${recipe.sourceUrl}" target="_blank" rel="noreferrer">${recipe.sourceUrl}</a></p>` : ''}
    </div>
    <div class="meta-grid">
      ${recipe.totalTime ? `<span class="pill">⏱️ Total: ${recipe.totalTime}</span>` : ''}
      ${recipe.prepTime ? `<span class="pill">🧺 Prep: ${recipe.prepTime}</span>` : ''}
      ${recipe.cookTime ? `<span class="pill">🔥 Cook: ${recipe.cookTime}</span>` : ''}
      ${recipe.servings ? `<span class="pill">🍽 Servings: ${recipe.servings}</span>` : ''}
    </div>
    ${recipe.description ? `<p>${recipe.description}</p>` : ''}
    <div class="section-title">Ingredients</div>
    <ul class="ingredients">${ingredients}</ul>
    <div class="section-title">Instructions</div>
    <ol class="instructions">${instructions}</ol>
  `;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

async function loadRecipes() {
  setStatus('Loading recipes…');
  try {
    const q = filterEl.value?.trim();
    const data = await fetchJson(`${API_URL}/recipes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    recipes = data;
    filtered = recipes;
    renderList(filtered);
    if (filtered.length) renderDetail(filtered[0]);
    setStatus(`Loaded ${filtered.length} recipe${filtered.length === 1 ? '' : 's'}.`);
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function deleteRecipe(id) {
  try {
    await fetchJson(`${API_URL}/recipes/${id}`, { method: 'DELETE' });
    recipes = recipes.filter((r) => r.id !== id);
    filtered = filtered.filter((r) => r.id !== id);
    renderList(filtered);
    renderDetail(filtered[0]);
    setStatus('Recipe deleted.');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = e.target.url.value.trim();
  if (!url) return;
  setStatus('Fetching recipe…');
  try {
    const data = await fetchJson(`${API_URL}/recipes/import`, {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    const recipe = data.recipe || data;
    const exists = recipes.find((r) => r.id === recipe.id);
    if (!exists) {
      recipes.unshift(recipe);
    } else {
      Object.assign(exists, recipe);
    }
    filtered = recipes;
    renderList(filtered);
    renderDetail(recipe);
    e.target.reset();
    setStatus(data.message || 'Recipe saved.');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

filterEl.addEventListener('input', () => {
  const q = filterEl.value.trim().toLowerCase();
  filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      (r.sourceUrl && r.sourceUrl.toLowerCase().includes(q))
  );
  renderList(filtered);
});

reloadBtn.addEventListener('click', () => loadRecipes());

loadRecipes();
