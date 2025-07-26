// express
import express from 'express'
const app = express()

// dotenv
import 'dotenv/config'

// ejs
app.set("view engine", "ejs")

// postgres
import pkg from 'pg'
const { Pool } = pkg
const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432,
})

app.use(express.urlencoded({ extended: true }))

async function initCaloriesTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS calories (id SERIAL PRIMARY KEY, total INTEGER NOT NULL, date_logged  DATE DEFAULT CURRENT_DATE)`)
}
initCaloriesTable()

// route route
app.get('/', async (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    const result = await pool.query('SELECT SUM(total) AS total FROM calories WHERE date_logged = $1', [formattedDate])

    res.render("index.ejs", {
        caloriesConsumed: result.rows[0]?.total || 0,
        date: formattedDate
    })
})

// input/undo routes
app.post('/add-calories', async (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    let dateParam = req.body.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    await pool.query('INSERT INTO calories (total, date_logged) VALUES ($1, $2)', [calsInputed, formattedDate])

    res.redirect(`/?date=${formattedDate}`)
})

app.post('/undo-calories', async (req, res) => {
    let dateParam = req.body.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    await pool.query('DELETE FROM calories WHERE id = (SELECT id FROM calories WHERE date_logged = $1 ORDER BY id DESC LIMIT 1)', [formattedDate])
    res.redirect(`/?date=${formattedDate}`)
})

// day routes
app.get('/prev-day', (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()

    currentDate.setDate(currentDate.getDate() - 1)

    res.redirect(`/?date=${currentDate.toISOString().split('T')[0]}`)
})

app.get('/next-day', (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()

    currentDate.setDate(currentDate.getDate() + 1)

    res.redirect(`/?date=${currentDate.toISOString().split('T')[0]}`)
})

// connection
const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
