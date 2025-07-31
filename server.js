// express
import express, { response } from 'express'
const app = express()
// dotenv
import 'dotenv/config'
// better auth
import { auth, pool } from "./auth.js"
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import { APIError } from 'better-auth/api'
// ejs
app.set("view engine", "ejs")
app.use(express.static('public'));

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.all("/api/auth/{*any}", toNodeHandler(auth));


async function initTables() {
    // await pool.query(`DROP TABLE IF EXISTS calories CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS "account" CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS "verification" CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS "session" CASCADE`);
    // await pool.query(`DROP TABLE IF EXISTS "user" CASCADE`);

    await pool.query(`CREATE TABLE IF NOT EXISTS calories (id SERIAL PRIMARY KEY, total INTEGER NOT NULL, date_logged  DATE DEFAULT CURRENT_DATE, user_id TEXT NOT NULL, food_name TEXT)`)

    await pool.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL,
      image TEXT,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    );
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    );
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    );
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMP,
      "refreshTokenExpiresAt" TIMESTAMP,
      scope TEXT,
      "idToken" TEXT,
      password TEXT,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    );
  `);
}
initTables()

async function requireAuth(req, res, next) {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers)
    });

    if (!session || !session.user) {
        return res.redirect('/log-in');
    }

    // Add user info to request for use in routes
    req.user = session.user;

    next();
}

// user auth routes
app.get('/sign-up', (req, res) => {
    res.render('signup', { error: null })
})

app.post('/sign-up', async (req, res) => {
    const { email, password, name } = req.body;

    try {
        await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            }

        })

        const response = await auth.api.signInEmail({
            body: { email, password },
            headers: fromNodeHeaders(req.body),
            asResponse: true
        })

        res.set('set-cookie', response.headers.get('set-cookie'));

        res.redirect('/')
    } catch (error) {
        if (error instanceof APIError) {
            res.render('signup', {
                error: error.message
            })

        }
    }
})

app.get('/log-in', (req, res) => {
    res.render('login', { error: null })
})

app.post('/log-in', async (req, res) => {
    const { email, password } = req.body;

    const response = await auth.api.signInEmail({
        body: { email, password },
        headers: fromNodeHeaders(req.headers),
        asResponse: true
    });

    if (!response.ok) {
        const error = await response.json()
        return res.render('login', { error: error.message || "asf" })
    }
    res.set('set-cookie', response.headers.get('set-cookie'));
    return res.redirect('/')
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

app.get('/', requireAuth, async (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]


    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    let name = session.user.name
    let upper = name.toUpperCase()
    const result = await pool.query(
        'SELECT id, total, food_name FROM calories WHERE date_logged = $1 AND user_id = $2 ORDER BY id ASC',
        [formattedDate, req.user.id]
    );

    const totalCalories = result.rows.reduce((sum, row) => sum + row.total, 0);

    res.render("index.ejs", {
        caloriesConsumed: totalCalories,
        calorieEntries: result.rows, // pass entries
        date: formattedDate,
        user: upper,
    });

})

app.post('/delete-entry', requireAuth, async (req, res) => {
    const { entryId, date } = req.body;

      await pool.query('DELETE FROM calories WHERE id = $1 AND user_id = $2', [entryId, req.user.id]);

    res.redirect(`/?date=${encodeURIComponent(date)}`);
});

app.post('/add-calories', requireAuth, async (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    let dateParam = req.body.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()
    let formattedDate = currentDate.toISOString().split('T')[0]

    await pool.query('INSERT INTO calories (total, date_logged,user_id) VALUES ($1, $2, $3)', [calsInputed, formattedDate, req.user.id])

    res.redirect(`/?date=${formattedDate}`)
})

app.get('/prev-day', requireAuth, (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()

    currentDate.setDate(currentDate.getDate() - 1)

    res.redirect(`/?date=${currentDate.toISOString().split('T')[0]}`)
})

app.get('/next-day', requireAuth, (req, res) => {
    let dateParam = req.query.date
    let currentDate = dateParam ? new Date(dateParam) : new Date()

    currentDate.setDate(currentDate.getDate() + 1)

    res.redirect(`/?date=${currentDate.toISOString().split('T')[0]}`)
})

app.get('/search', requireAuth, (req, res) => {
    res.render('search', { results_for_food_searched: null, foods: null, date: req.query.date })
})

app.post('/search', requireAuth, async (req, res) => {
    const food = req.body.food_searched_for
    const date = req.body.date
    console.log(date);


    const url = `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(food)}`

    const response = await fetch(url, {
        headers: {
            'x-app-id': process.env.NUTRITIONIX_APP_ID,
            'x-app-key': process.env.NUTRITIONIX_API_KEY,
        },
    });
    const data = await response.json()
    // console.log(data);


    res.render('search', {
        foods: data.common,
        date: date
    })

})

app.post('/add-food', requireAuth, async (req, res) => {
    const {
        food_name,
        serving_unit,
        base_calories,
        base_qty,
        custom_qty,
        date
    } = req.body;

    // Calculate actual calories
    const calories = (base_calories / base_qty) * custom_qty;

    await pool.query(
        `INSERT INTO calories (total, date_logged, user_id, food_name) VALUES ($1, $2, $3, $4)`,
        [Math.round(calories), date, req.user.id, food_name]
    );


    console.log(`Added: ${calories.toFixed(2)} cal of ${food_name} for ${date}`);

    // Redirect back to main or search page for that date
    res.redirect(`/?date=${encodeURIComponent(date)}`);
});

// connection
const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
