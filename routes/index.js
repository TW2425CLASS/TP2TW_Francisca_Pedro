const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const passport = require('passport');

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

router.get('/', (req, res) => res.redirect('/dashboard'));

router.get('/login', (req, res) => res.render('login'));
router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login'
}));

router.get('/register', (req, res) => res.render('register'));
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      
      return res.render('register', { error: 'Nome de utilizador já existe. Escolhe outro.' });
    }

    await User.create({ username, password });
    res.redirect('/login');
  } catch (err) {
    console.error('Erro no registo:', err);
    res.render('register', { error: 'Erro no servidor. Tenta novamente mais tarde.' });
  }
});


router.get('/dashboard', ensureAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.render('dashboard', { 
    user: user.username, 
    history: user.searches  || [],
    weather: null, 
    wiki: null 
  });
});

router.post('/search', ensureAuth, async (req, res) => {
  try {
    const { query } = req.body;

    
    if (!query || query.trim().length < 2 || /[^a-zA-ZÀ-ÿ0-9\s\-]/.test(query)) {
      return res.render('dashboard', {
        user: req.user.username,
        weather: null,
        wiki: null,
        history: req.user.searches,
        error: 'Por favor insere um termo de pesquisa válido.'
      });
    }

    const user = await User.findById(req.user._id);
    user.searches.push(query.trim());
    await user.save();

    const [weatherRes, wikiRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&lang=pt&appid=${process.env.WEATHER_API}`),
      axios.get(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`)
    ]);

    res.render('dashboard', {
      user: req.user.username,
      weather: weatherRes.data,
      wiki: wikiRes.data,
      history: user.searches,
      error: null
    });
  } catch (err) {
    console.error("Erro durante a pesquisa:", err.message);

    res.render('dashboard', {
      user: req.user?.username || 'Utilizador',
      weather: null,
      wiki: null,
      history: req.user?.searches || [],
      error: 'Erro ao processar a pesquisa. Tenta novamente.'
    });
  }
});

router.post('/clear-history', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.searches = [];
    await user.save();
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Erro ao limpar histórico:', err);
    res.redirect('/dashboard');
  }
});

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

module.exports = router;