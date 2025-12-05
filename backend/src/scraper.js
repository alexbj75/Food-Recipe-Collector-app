import * as cheerio from 'cheerio';

function parseIsoDuration(duration) {
  if (!duration || typeof duration !== 'string') return '';
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return duration;
  const [, days, hours, minutes] = match.map((v) => (v ? parseInt(v, 10) : 0));
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(' ') : duration;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (!v) return null;
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'object' && v.text) return String(v.text).trim();
        return null;
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function extractJsonLdRecipe($) {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i += 1) {
    const raw = $(scripts[i]).contents().text();
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (Array.isArray(candidate['@graph'])) {
          const fromGraph = candidate['@graph'].find((node) => {
            const type = node['@type'];
            return type && (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')));
          });
          if (fromGraph) return fromGraph;
        }
        const type = candidate['@type'];
        if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
          return candidate;
        }
      }
    } catch (err) {
      // ignore malformed blocks
    }
  }
  return null;
}

function buildRecipeFromDom($, fallbackTitle = '') {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="title"]').attr('content') ||
    $('title').text().trim() ||
    fallbackTitle;
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';
  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="image"]').attr('content') ||
    '';
  return { title, description, image, ingredients: [], instructions: [] };
}

export async function scrapeRecipe(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RecipeCollector/1.0 (+github.com/eyevinn)' }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recipe page (status ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const structured = extractJsonLdRecipe($);

  let recipe = buildRecipeFromDom($, structured?.name || '');

  if (structured) {
    recipe = {
      ...recipe,
      title: structured.name || recipe.title,
      description: structured.description || recipe.description,
      image:
        (Array.isArray(structured.image) ? structured.image[0] : structured.image) ||
        recipe.image,
      servings: structured.recipeYield || structured.recipeServings || '',
      prepTime: parseIsoDuration(structured.prepTime || structured.prep_time),
      cookTime: parseIsoDuration(structured.cookTime || structured.cook_time),
      totalTime: parseIsoDuration(structured.totalTime || structured.total_time),
      ingredients: normalizeList(structured.recipeIngredient || structured.ingredients),
      instructions: normalizeList(structured.recipeInstructions)
    };
  }

  if (!recipe.title) {
    throw new Error('Could not extract a title from the recipe page');
  }

  if (!recipe.ingredients.length) {
    // Try to collect ingredients from common selectors as a fallback
    const candidates = [];
    $('[class*=ingredient]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 2) candidates.push(text);
    });
    if (candidates.length) {
      recipe.ingredients = candidates.slice(0, 50);
    }
  }

  if (!recipe.instructions.length) {
    const steps = [];
    $('[class*=instruction], [class*=step], ol li').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 4) steps.push(text);
    });
    if (steps.length) {
      recipe.instructions = steps.slice(0, 50);
    }
  }

  return {
    title: recipe.title.trim(),
    description: recipe.description?.trim() || '',
    image: recipe.image || '',
    servings: recipe.servings || '',
    prepTime: recipe.prepTime || '',
    cookTime: recipe.cookTime || '',
    totalTime: recipe.totalTime || '',
    ingredients: recipe.ingredients,
    instructions: recipe.instructions
  };
}
