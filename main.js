const express = require("express");
const dbConnect = require("./config/dbConnect");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

dbConnect();

app.get("/", (req, res) => {
    res.send('Hello, Node!');
});

app.use("/api/hourly", require("./routes/hourlyRoutes"));

app.listen(PORT, () => {
    console.log(`서버 실행 중 (포트: ${PORT})`);
});