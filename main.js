const express = require("express");
const dbConnect = require("./config/dbConnect");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

app.use(express.json());

dbConnect();

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
    res.send(path.join(__dirname, 'index.html'));
});

app.use("/api/hourly", require("./routes/hourlyRoutes"));

app.listen(PORT, () => {
    console.log(`서버 실행 중 (포트: ${PORT})`);
});