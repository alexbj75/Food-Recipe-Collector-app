import { initI18n, t, setLanguage, getCurrentLanguage } from './i18n.js';

const apiBase = window.location.origin.includes('3000')
  ? 'http://localhost:4000'
  : window.location.origin;
const API_URL = `${apiBase}/api`;

const listEl = document.getElementById('recipes-list');
const archivedEl = document.getElementById('archived-list');
const detailEl = document.getElementById('recipe-detail');
const archivedDetailEl = document.getElementById('archived-detail');
const statusEl = document.getElementById('status');
const filterEl = document.getElementById('filter');
const reloadBtn = document.getElementById('reload-btn');
const languageSelect = document.getElementById('language-select');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

let activeRecipes = [];
let archivedRecipes = [];
let selectedActive = null;
let selectedArchived = null;

// View switching
function switchView(viewName) {
  views.forEach((view) => view.classList.remove('active'));
  navItems.forEach((item) => item.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  const targetNav = document.querySelector(`[data-view="${viewName}"]`);

  if (targetView) targetView.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
}

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const viewName = item.getAttribute('data-view');
    switchView(viewName);
  });
});

// Apply translations to all elements with data-i18n attributes
function applyTranslations() {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (el.tagName === 'TITLE') {
      document.title = t(key);
    } else {
      el.textContent = t(key);
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
}

// Handle language change
async function handleLanguageChange(lang) {
  await setLanguage(lang);
  applyTranslations();
  // Re-render dynamic content
  renderList(listEl, activeRecipes, { archived: false, detailEl: detailEl });
  renderList(archivedEl, archivedRecipes, { archived: true, detailEl: archivedDetailEl });
  renderDetail(detailEl, selectedActive);
  renderDetail(archivedDetailEl, selectedArchived);
}

function setStatus(message, type = 'success') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function renderList(container, items, { archived = false, detailEl } = {}) {
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = `<li class="recipe-card">${t('recipeCard.noRecipes')}</li>`;
    return;
  }

  items.forEach((recipe) => {
    const li = document.createElement('li');
    li.className = 'recipe-card';
    const archiveLabel = archived ? t('recipeCard.unarchive') : t('recipeCard.archive');
    li.innerHTML = `
      <div>
        <div class="eyebrow" style="margin:0">${recipe.sourceUrl ? new URL(recipe.sourceUrl).hostname : 'Recipe'}</div>
        <div><strong>${recipe.title}</strong></div>
        <div class="recipe-card__meta">${recipe.description?.slice(0, 120) || t('recipeCard.noDescription')}</div>
        <div class="meta-grid">
          ${recipe.totalTime ? `<span class="pill">⏱️ ${recipe.totalTime}</span>` : ''}
          ${recipe.servings ? `<span class="pill">🍽 ${recipe.servings}</span>` : ''}
        </div>
      </div>
      <button class="delete-btn" data-id="${recipe.id}">${archiveLabel}</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      if (archived) {
        selectedArchived = recipe;
        renderDetail(archivedDetailEl, recipe);
      } else {
        selectedActive = recipe;
        renderDetail(detailEl, recipe);
      }
    });

    li.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (archived) {
        await unarchiveRecipe(recipe.id);
      } else {
        await archiveRecipe(recipe.id);
      }
    });

    container.appendChild(li);
  });
}

function renderDetail(container, recipe) {
  if (!recipe) {
    container.classList.add('empty');
    container.innerHTML = `<p>${t('preview.emptyState')}</p>`;
    return;
  }

  container.classList.remove('empty');
  const ingredients = recipe.ingredients?.length
    ? recipe.ingredients.map((i) => `<li>${i}</li>`).join('')
    : `<li>${t('recipeDetail.noIngredients')}</li>`;
  const instructions = recipe.instructions?.length
    ? recipe.instructions.map((i) => `<li>${i}</li>`).join('')
    : `<li>${t('recipeDetail.noInstructions')}</li>`;

  container.innerHTML = `
    <div class="header">
      <h3>${recipe.title}</h3>
      ${recipe.sourceUrl ? `<p class="recipe-card__meta"><a href="${recipe.sourceUrl}" target="_blank" rel="noreferrer">${recipe.sourceUrl}</a></p>` : ''}
    </div>
    <div class="edit-toggle">
      <button id="edit-toggle-btn-${recipe.id}" class="icon-btn" type="button">${t('recipeDetail.edit')}</button>
    </div>
    <div class="meta-grid">
      ${recipe.totalTime ? `<span class="pill">⏱️ ${t('recipeDetail.total')}: ${recipe.totalTime}</span>` : ''}
      ${recipe.prepTime ? `<span class="pill">🧺 ${t('recipeDetail.prep')}: ${recipe.prepTime}</span>` : ''}
      ${recipe.cookTime ? `<span class="pill">🔥 ${t('recipeDetail.cook')}: ${recipe.cookTime}</span>` : ''}
      ${recipe.servings ? `<span class="pill">🍽 ${t('recipeDetail.servings')}: ${recipe.servings}</span>` : ''}
    </div>
    ${recipe.description ? `<p>${recipe.description}</p>` : ''}
    <div id="edit-container-${recipe.id}" style="display:none;">
      <div class="section-title">${t('recipeDetail.editTitle')}</div>
      <form id="edit-form-${recipe.id}" class="stack">
        <input name="title" type="text" value="${recipe.title}" required />
        <textarea name="description" rows="3" placeholder="${t('recipeDetail.descriptionPlaceholder')}">${recipe.description || ''}</textarea>
        <div class="field__row">
          <input name="servings" type="text" placeholder="${t('recipeDetail.servingsPlaceholder')}" value="${recipe.servings || ''}" />
          <input name="totalTime" type="text" placeholder="${t('recipeDetail.totalTimePlaceholder')}" value="${recipe.totalTime || ''}" />
        </div>
        <div class="field__row">
          <input name="prepTime" type="text" placeholder="${t('recipeDetail.prepTimePlaceholder')}" value="${recipe.prepTime || ''}" />
          <input name="cookTime" type="text" placeholder="${t('recipeDetail.cookTimePlaceholder')}" value="${recipe.cookTime || ''}" />
        </div>
        <textarea name="ingredients" rows="4" placeholder="${t('recipeDetail.ingredientsPlaceholder')}">${(recipe.ingredients || []).join('\n')}</textarea>
        <textarea name="instructions" rows="6" placeholder="${t('recipeDetail.instructionsPlaceholder')}">${(recipe.instructions || []).join('\n')}</textarea>
        <div class="actions">
          <button type="submit" class="primary">${t('recipeDetail.saveChanges')}</button>
        </div>
      </form>
    </div>
    <div class="section-title">${t('preview.sectionTitle')}</div>
    <ul class="ingredients">${ingredients}</ul>
    <ol class="instructions">${instructions}</ol>
  `;

  const editContainer = document.getElementById(`edit-container-${recipe.id}`);
  const editToggleBtn = document.getElementById(`edit-toggle-btn-${recipe.id}`);
  editToggleBtn.addEventListener('click', () => {
    editContainer.style.display = editContainer.style.display === 'none' ? 'block' : 'none';
  });

  const editForm = document.getElementById(`edit-form-${recipe.id}`);
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(editForm);
    const payload = {
      title: formData.get('title').trim(),
      description: formData.get('description'),
      servings: formData.get('servings'),
      totalTime: formData.get('totalTime'),
      prepTime: formData.get('prepTime'),
      cookTime: formData.get('cookTime'),
      ingredients: formData
        .get('ingredients')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      instructions: formData
        .get('instructions')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    };
    await updateRecipe(recipe.id, payload);
  });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return {};
  let body;
  try {
    body = await res.json();
  } catch (err) {
    body = {};
  }
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body;
}

async function loadRecipes() {
  setStatus(t('status.loading'));
  try {
    const q = filterEl.value?.trim().toLowerCase();
    const active = await fetchJson(`${API_URL}/recipes${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const archived = await fetchJson(
      `${API_URL}/recipes?archived=true${q ? `&q=${encodeURIComponent(q)}` : ''}`
    );
    activeRecipes = active;
    archivedRecipes = archived;
    renderList(listEl, activeRecipes, { archived: false, detailEl: detailEl });
    renderList(archivedEl, archivedRecipes, { archived: true, detailEl: archivedDetailEl });

    // Update selected if needed
    if (!selectedActive || !activeRecipes.find((r) => r.id === selectedActive.id)) {
      selectedActive = activeRecipes[0] || null;
    }
    if (!selectedArchived || !archivedRecipes.find((r) => r.id === selectedArchived.id)) {
      selectedArchived = archivedRecipes[0] || null;
    }

    renderDetail(detailEl, selectedActive);
    renderDetail(archivedDetailEl, selectedArchived);

    const total = activeRecipes.length + archivedRecipes.length;
    const statusKey = total === 1 ? 'status.loadedSingular' : 'status.loaded';
    setStatus(t(statusKey, { active: activeRecipes.length, archived: archivedRecipes.length }));
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function archiveRecipe(id) {
  try {
    await fetchJson(`${API_URL}/recipes/${id}/archive`, { method: 'POST' });
    selectedActive = null;
    await loadRecipes();
    setStatus(t('status.archived'));
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function unarchiveRecipe(id) {
  try {
    await fetchJson(`${API_URL}/recipes/${id}/unarchive`, { method: 'POST' });
    selectedArchived = null;
    await loadRecipes();
    setStatus(t('status.unarchived'));
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function updateRecipe(id, payload) {
  try {
    const data = await fetchJson(`${API_URL}/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    // Update appropriate selected recipe
    if (selectedActive && selectedActive.id === id) {
      selectedActive = data.recipe;
    }
    if (selectedArchived && selectedArchived.id === id) {
      selectedArchived = data.recipe;
    }
    await loadRecipes();
    setStatus(t('status.updated'));
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = e.target.url.value.trim();
  if (!url) return;
  setStatus(t('status.fetching'));
  try {
    const data = await fetchJson(`${API_URL}/recipes/import`, {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    selectedActive = data.recipe || data;
    e.target.reset();
    await loadRecipes();
    setStatus(data.message || t('status.saved'));
    // Switch to collection view to see the new recipe
    switchView('collection');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

filterEl.addEventListener('input', () => {
  loadRecipes();
});

reloadBtn.addEventListener('click', () => loadRecipes());

languageSelect.addEventListener('change', (e) => {
  handleLanguageChange(e.target.value);
});

// Initialize the app
async function init() {
  const currentLang = await initI18n();
  languageSelect.value = currentLang;
  applyTranslations();
  loadRecipes();
}

init();
