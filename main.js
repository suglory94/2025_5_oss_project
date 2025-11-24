const express = require("express");
const dbConnect = require("./config/dbConnect");

const app = express();

dbConnect();

app.get("/", (req, res) => {
    res.send('Hello, Node!');
});

app.use("/", require("./routes/parallelRoutes"));

app.listen(3000, () => {
    console.log("서버 실행 중");
});