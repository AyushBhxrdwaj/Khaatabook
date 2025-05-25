const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()
const dir = path.join(__dirname, 'files');
const mongoose = require('mongoose')
require('dotenv').config()
const session = require('express-session')
const MongoStore = require('connect-mongo');
const authRoutes = require('./backend/routes/auth')
const crypto = require('crypto');



app.use(session({
    secret: process.env.Secret_key,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/khaatabook' }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }

}));

function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.redirect('auth/login?session=expired')
    }
    next()
}

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});





mongoose.connect('mongodb://127.0.0.1:27017/khaatabook').then(() => {
    console.log("Connected to DB")
}).catch((err) => {
    console.log("Database err", err)
});

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use('/auth', authRoutes);

app.get('/', requireLogin, (req, res) => {
    const userID = req.session.userID
    const username = req.session.username;
    const userDir = path.join(dir, userID.toString());
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }
    fs.readdir(userDir, (err, files) => {
        if (err) {
            return res.status(500).send(err)
        } res.render('index', { files, username })
    })
});

function encryptText(text, password) {
    const key = crypto.scryptSync(password, 'salt', 24);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

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
    const name = getCurrentDate();
    const userDir = path.join(dir, req.session.userID.toString());
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir);
    }

    let filepath = path.join(userDir, `${name}.txt`);
    let counter = 1;
    while (fs.existsSync(filepath)) {
        filepath = path.join(userDir, `${name}(${counter}).txt`);
        counter++;
    }

    let data = req.body.content;
    const encrypt_file = req.body.encrypt;
    const passcode = req.body.passcode;




    if (encrypt_file && passcode) {
        data = '[ENCRYPTED]\n' + encryptText(data, passcode);
    }

    fs.writeFile(filepath, data, (err) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.redirect('/');
    });
});

app.get('/edit/:filename', (req, res) => {
    const file = req.params.filename
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file)
    fs.readFile(filepath, 'utf-8', (err, data) => {
        if (err) {
            return res.status(500).send(err)
        }
        if (data.startsWith('[ENCRYPTED]')) {
            return res.render('passwordedit', { file })
        }
        res.render('edit', { file, data })
    });
});


app.post('/update/:filename', (req, res) => {
    const file = req.params.filename
    const { content, encrypt, passcode } = req.body;
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file)

    let datatowrite = content;

    if (encrypt && passcode) {
        datatowrite = "[ENCRYPTED]\n" + encryptText(content, passcode);
    }
    fs.writeFile(filepath, datatowrite, (err) => {
        if (err) {
            return res.status(500).send(err)
        }
        res.redirect('/')
    })
})

app.get('/hisaab/:filename', (req, res) => {
    const file = req.params.filename
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file)
    fs.readFile(filepath, 'utf-8', (err, data) => {
        if (err) {
            return res.status(500).send(err)

        }
        if (data.startsWith('[ENCRYPTED]')) {
            return res.render('passwordPrompt', { file });
        }

        res.render('data', { file, data })
    })
})

app.get('/delete/:filename', (req, res) => {
    const file = req.params.filename
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file)
    fs.unlink(filepath, (err) => {
        if (err) {
            return res.status(500).send(err)
        } res.redirect('/')
    })
})


function decrypt(text, password) {
    const [ivHex, encryptedHex] = text.split(':');
    const key = crypto.scryptSync(password, 'salt', 24);
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString();
}

app.post('/decrypt/:filename', requireLogin, (req, res) => {
    const file = req.params.filename;
    const password = req.body.password;
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file);
    console.log("Decrypting file:", file);
    console.log("Password received:", password);

    fs.readFile(filepath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send(err);

        try {
            const encryptedText = data.replace('[ENCRYPTED]\n', '');
            const decrypted = decrypt(encryptedText, password);
            res.render('data', { file, data: decrypted });
        } catch (err) {
            res.send("Incorrect password or decryption failed.");
        }

    });


});

app.post('/decrypt-edit/:filename', (req, res) => {
    const file = req.params.filename;
    const password = req.body.password;
    const userDir = path.join(dir, req.session.userID.toString());
    const filepath = path.join(userDir, file);

    fs.readFile(filepath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send(err);

        try {
            const encryptedText = data.replace('[ENCRYPTED]\n', '');
            const decrypted = decrypt(encryptedText, password);

            res.render('edit', { file, data: decrypted });
        } catch (err) {
            res.send("Incorrect password or decryption failed.");
        }
    });
});







app.listen(3000, () => {
    console.log("Server is running on port 3000")
})