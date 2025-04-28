const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()

const dir = path.join(__dirname, 'files');

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.get('/', (req, res) => {
    fs.readdir(dir, (err, files) => {
        if (err) {
            return res.status(500).send(err)
        } res.render('index', { files })
    })
});

app.get('/create', (req, res) => {
    res.render('create')
})
app.post('/create', (req, res) => {
    function getCurrentDate() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    }

    const name = getCurrentDate()
    let filepath = path.join(dir, `${name}.txt`)
    let counter = 2;
    
    let data = req.body.content;
    while(fs.existsSync(filepath)){
        filepath=path.join(dir,`${name}.txt (${counter})`)
        counter++;
    }

    fs.writeFile(filepath, data, (err) => {
        if (err) {
            return res.status(500).send(err)
        } res.redirect('/')
    })
})

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})