import express from 'express';
import { query } from '../db.js';
import { scrapeRecipe } from '../scraper.js';

const router = express.Router();

function serializeRow(row) {
  const toArray = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    description: row.description || '',
    image: row.image_url || '',
    servings: row.servings || '',
    prepTime: row.prep_time || '',
    cookTime: row.cook_time || '',
    totalTime: row.total_time || '',
    ingredients: toArray(row.ingredients),
    instructions: toArray(row.instructions),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.get('/', async (req, res, next) => {
  try {
    const search = req.query.q?.trim();
    let sql = 'SELECT * FROM recipes';
    const params = [];

    if (search) {
      sql += ' WHERE title LIKE ? OR source_url LIKE ?';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await query(sql, params);
    res.json(rows.map(serializeRow));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await query('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Recipe not found' });
    return res.json(serializeRow(rows[0]));
  } catch (err) {
    return next(err);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ message: 'Invalid URL' });
    }

    const [existing] = await query('SELECT * FROM recipes WHERE source_url = ?', [parsedUrl.toString()]);
    if (existing.length) {
      return res.status(200).json({ recipe: serializeRow(existing[0]), message: 'Recipe already saved' });
    }

    const recipeData = await scrapeRecipe(parsedUrl.toString());

    const [result] = await query(
      `INSERT INTO recipes 
       (title, source_url, description, image_url, servings, prep_time, cook_time, total_time, ingredients, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipeData.title,
        parsedUrl.toString(),
        recipeData.description,
        recipeData.image,
        recipeData.servings,
        recipeData.prepTime,
        recipeData.cookTime,
        recipeData.totalTime,
        JSON.stringify(recipeData.ingredients || []),
        JSON.stringify(recipeData.instructions || [])
      ]
    );

    const [rows] = await query('SELECT * FROM recipes WHERE id = ?', [result.insertId]);
    return res.status(201).json({ recipe: serializeRow(rows[0]) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await query('SELECT id FROM recipes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Recipe not found' });
    await query('DELETE FROM recipes WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
