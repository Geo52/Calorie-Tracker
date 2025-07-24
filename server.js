//express
const express = require('express')
const app = express()

// dotenv
require('dotenv').config()

// ejs
app.set("view engine", "ejs")

// postgres
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432,
});

app.use(express.urlencoded({ extended: true }))

async function initCaloriesTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS calories (id SERIAL PRIMARY KEY, total INTEGER NOT NULL)`);
}
initCaloriesTable()

// GET
app.get('/', async (req, res) => {
    const result = await pool.query('SELECT SUM(total) AS total FROM calories');

    res.render("index.ejs", {
        caloriesConsumed: result.rows[0]?.total || 0
    })
})

// POST
app.post('/add-calories', async (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    await pool.query('INSERT INTO calories (total) VALUES ($1)', [calsInputed]);
    res.redirect('/')
})

app.post('/undo-calories', async (req, res) => {
    await pool.query('DELETE FROM calories WHERE id = (SELECT id FROM calories ORDER BY id DESC LIMIT 1)');
    res.redirect('/')
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
