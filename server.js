const express = require('express')
const app = express()
app.set("view engine", "ejs")
const port = process.env.PORT || 3000 // Use Render's port or 3000 locally

app.use(express.urlencoded({ extended: true })) // Add body parser for form data

let caloriesConsumed = 0 // Store calories in memory

app.get('/', (req, res) => {
    res.render("index.ejs", {
        caloriesConsumed
    })
})

app.post('/add-calories', (req, res) => {
    const calsInputed = parseInt(req.body.calories)
    if (!isNaN(calsInputed)) {
        caloriesConsumed += calsInputed
    }
    res.redirect('/')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
