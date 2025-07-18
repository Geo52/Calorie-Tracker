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

// Initialize caloriesConsumed from DB or set to 0 if not present
let caloriesConsumed = 0;

async function initCalories() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS calories (id SERIAL PRIMARY KEY, total INTEGER NOT NULL)`);
        const result = await pool.query('SELECT total FROM calories WHERE id = 1');
        if (result.rows.length === 0) {
            await pool.query('INSERT INTO calories (id, total) VALUES (1, 0)');
            caloriesConsumed = 0;
        } else {
            caloriesConsumed = result.rows[0].total;
        }
    } catch (err) {
        console.error('Error initializing calories:', err);
    }
}

initCalories();

app.get('/', async (req, res) => {
    // Always get the latest value from DB
    try {
        const result = await pool.query('SELECT total FROM calories WHERE id = 1');
        caloriesConsumed = result.rows[0]?.total || 0;
    } catch (err) {
        console.error('Error fetching calories:', err);
    }
    res.render("index.ejs", {
        caloriesConsumed
    })
})

app.post('/add-calories', async (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    if (!isNaN(calsInputed)) {
        try {
            // Update DB value
            await pool.query('UPDATE calories SET total = total + $1 WHERE id = 1', [calsInputed]);
        } catch (err) {
            console.error('Error updating calories:', err);
        }
    }
    res.redirect('/')
})

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error executing query', err.stack);
    } else {
        console.log('PostgreSQL connected:', res.rows[0]);
    }
});

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
