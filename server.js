// express
import express from 'express'
const app = express()
// dotenv
import 'dotenv/config'
// better auth
import { auth, pool } from "./auth.js"
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
//cors
import cors from "cors"
// ejs
app.set("view engine", "ejs")

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.all("/api/auth/{*any}", toNodeHandler(auth));


async function initCaloriesTable() {
    await pool.query(`CREATE TABLE IF NOT EXISTS calories (id SERIAL PRIMARY KEY, total INTEGER NOT NULL, date_logged  DATE DEFAULT CURRENT_DATE, user_id TEXT NOT NULL)`)
}
initCaloriesTable()

async function requireAuth(req, res, next) {
    const session = await auth.api.getSession({
        headers: req.headers
    });

    if (!session || !session.user) {
        return res.redirect('/log-in');
    }

    // Add user info to request for use in routes
    req.user = session.user;
    next();
}

app.get('/sign-up', (req, res) => {
    res.render('signup')
})

app.post('/sign-up', async (req, res) => {
    const { email, password, name } = req.body;

    const response = await auth.api.signUpEmail({
        body: {
            email,
            password,
            name,
            // callbackURL: "http://localhost:3000/log-in"
        }
    })
    res.redirect('/log-in')
})

app.get('/log-in', (req, res) => {
    res.render('login')
})

app.post('/log-in', async (req, res) => {
    const { email, password } = req.body;

    const data = await auth.api.signInEmail({
        body: {
            email, // required
            password, // required
            // rememberMe: true,
            // callbackURL: "https://example.com/callback",
        },
        // This endpoint requires session cookies.
        headers: req.headers,
        asResponse: true
    });

    const setCookiesHeader = data.headers.get('set-cookie')
    res.set('set-cookie', setCookiesHeader)

    res.redirect('/')
})

app.post('/logout', async (req, res) => {
    const result = await auth.api.signOut({
        headers: req.headers,
        asResponse: true
    })

    const setCookieHeader = result.headers.get('set-cookie');
    res.set('set-cookie', setCookieHeader);

    res.redirect('/log-in')
})

// route route
app.get('/', requireAuth, async (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    const result = await pool.query('SELECT SUM(total) AS total FROM calories WHERE date_logged = $1 AND USER_ID = $2', [formattedDate, req.user.id])

    res.render("index.ejs", {
        caloriesConsumed: result.rows[0]?.total || 0,
        date: formattedDate
    })
})
// input/undo routes
app.post('/add-calories',requireAuth, async (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    let dateParam = req.body.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    await pool.query('INSERT INTO calories (total, date_logged,user_id) VALUES ($1, $2, $3)', [calsInputed, formattedDate, req.user.id])

    res.redirect(`/?date=${formattedDate}`)
})

app.post('/undo-calories', async (req, res) => {
    let dateParam = req.body.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    await pool.query('DELETE FROM calories WHERE id = (SELECT id FROM calories WHERE date_logged = $1 AND user_id = $2 ORDER BY id DESC LIMIT 1)', [formattedDate, req.user.id])
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
