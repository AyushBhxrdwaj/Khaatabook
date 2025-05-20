const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const router = express.Router();


router.get('/signup', (req, res) => {
    if(req.session.userID){
        return res.render('/')
    }
    res.render('new.ejs');
});

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    req.session.userID = user._id;
    res.redirect('/auth/login?created=true');
});

router.get('/login', (req, res) => {
    if(req.session.userID){
        return res.redirect('/')
    }
    res.render('Login.ejs');
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.send("User not found, Create Account");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Wrong Password");

    req.session.userID = user._id;
    res.redirect('/?login=success');
});

router.get('/logout',(req,res)=>{
    req.session.destroy(err=>{
        if(err){
            return res.send("Error logging out!!")
        }
        res.clearCookie('connect.sid');
        res.redirect('/auth/login?logout=success')
    })
})

module.exports = router;
