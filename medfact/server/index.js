require('dotenv').config();
const express = require('express');
const cors = require('cors');
const verifyRoute = require('./routes/verify');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', verifyRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MedFact backend rodando na porta ${PORT}`));